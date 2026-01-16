import express from 'express';
import { Op } from 'sequelize';
import { User, Department } from '../models/index.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import userSyncService from '../utils/userSync.js';
import ldapService from '../config/ldap.js';
import exportService from '../utils/exportService.js';

const router = express.Router();

// Get all users (admin and IT manager only)
router.get('/', authenticateToken, requireRole('super_administrator', 'it_manager', 'department_approver'), async (req, res) => {
  try {
    const { search, department, role, status, page = 1, limit = 50 } = req.query;

    const whereClause = {};

    if (search) {
      whereClause[Op.or] = [
        { username: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } },
        { first_name: { [Op.iLike]: `%${search}%` } },
        { last_name: { [Op.iLike]: `%${search}%` } }
      ];
    }

    if (department) {
      whereClause.department_id = department;
    }

    if (role) {
      whereClause.role = role;
    }

    if (status) {
      whereClause.is_active = status === 'active';
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { count, rows: users } = await User.findAndCountAll({
      where: whereClause,
      include: [{
        model: Department,
        as: 'Department',
        attributes: ['id', 'name', 'description']
      }],
      attributes: { exclude: ['ad_groups', 'ad_dn'] },
      order: [['last_name', 'ASC'], ['first_name', 'ASC']],
      limit: parseInt(limit),
      offset
    });

    res.json({
      users: users.map(user => ({
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        fullName: user.getFullName(),
        role: user.role,
        title: user.title,
        phone: user.phone,
        isActive: user.is_active,
        lastLogin: user.last_login,
        department: user.Department ? {
          id: user.Department.id,
          name: user.Department.name,
          description: user.Department.description
        } : null,
        createdAt: user.created_at,
        updatedAt: user.updated_at
      })),
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      error: 'Failed to fetch users',
      message: error.message
    });
  }
});

// Get single user by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, {
      include: [{
        model: Department,
        as: 'Department'
      }],
      attributes: { exclude: ['ad_groups', 'ad_dn'] }
    });

    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'The requested user does not exist'
      });
    }

    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      fullName: user.getFullName(),
      role: user.role,
      title: user.title,
      phone: user.phone,
      isActive: user.is_active,
      lastLogin: user.last_login,
      department: user.Department ? {
        id: user.Department.id,
        name: user.Department.name,
        description: user.Department.description
      } : null,
      createdAt: user.created_at,
      updatedAt: user.updated_at
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({
      error: 'Failed to fetch user',
      message: error.message
    });
  }
});

// Update user role (super admin only)
router.patch('/:id/role', authenticateToken, requireRole('super_administrator'), async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    const validRoles = ['requestor', 'department_approver', 'it_manager', 'service_desk', 'super_administrator'];

    if (!validRoles.includes(role)) {
      return res.status(400).json({
        error: 'Invalid role',
        message: 'Role must be one of: ' + validRoles.join(', ')
      });
    }

    const user = await User.findByPk(id);

    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'The requested user does not exist'
      });
    }

    // Prevent changing the last super administrator
    if (user.role === 'super_administrator' && role !== 'super_administrator') {
      const otherAdmins = await User.count({
        where: {
          role: 'super_administrator',
          is_active: true,
          id: { [Op.ne]: id }
        }
      });

      if (otherAdmins === 0) {
        return res.status(400).json({
          error: 'Cannot change role',
          message: 'Cannot remove the last super administrator'
        });
      }
    }

    await user.update({ role });

    res.json({
      message: 'User role updated successfully',
      user: {
        id: user.id,
        username: user.username,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Error updating user role:', error);
    res.status(500).json({
      error: 'Failed to update user role',
      message: error.message
    });
  }
});

// Update user department (super_administrator only) - Syncs to both AD and Database
router.patch('/:id/department', authenticateToken, requireRole('super_administrator'), async (req, res) => {
  try {
    const { id } = req.params;
    const { departmentId, departmentName } = req.body;

    // Validate input
    console.log(`📝 Updating department for user ${id}:`, {
      departmentName,
      departmentNameType: typeof departmentName,
      body: req.body
    });

    if (!departmentName || typeof departmentName !== 'string' || departmentName.trim() === '') {
      return res.status(400).json({
        error: 'Invalid input',
        message: 'Department name is required and cannot be empty'
      });
    }

    // Find the user
    const user = await User.findByPk(id, {
      include: [{
        model: Department,
        as: 'Department'
      }]
    });

    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'The specified user does not exist'
      });
    }

    // Check if user has AD DN - if not, try to find them in AD
    console.log(`👤 User ${user.username} (ID: ${user.id}) - AD DN:`, user.ad_dn ? 'Present' : 'Missing');

    if (!user.ad_dn) {
      console.log(`🔍 User ${user.username} missing ad_dn, attempting to find in AD...`);

      try {
        // Try to find user in AD by username
        let adUserDN = await ldapService.findUserDN(user.username);

        // If not found by username, try by email
        if (!adUserDN && user.email) {
          console.log(`   Not found by username, trying email: ${user.email}`);
          adUserDN = await ldapService.findUserDNByEmail(user.email);
        }

        if (adUserDN) {
          console.log(`✅ Found user in AD with DN: ${adUserDN}`);
          // Update user's ad_dn in database
          await user.update({ ad_dn: adUserDN });
          user.ad_dn = adUserDN;
          console.log(`✅ Updated user ${user.username} with AD DN`);
        } else {
          return res.status(400).json({
            error: 'AD sync required',
            message: `User "${user.username}" was not found in Active Directory. Please ensure the user exists in AD and try syncing from AD first.`
          });
        }
      } catch (adLookupError) {
        console.error(`❌ Error looking up user ${user.username} in AD:`, adLookupError.message);
        return res.status(400).json({
          error: 'AD lookup failed',
          message: `Could not find user "${user.username}" in Active Directory. Error: ${adLookupError.message}. Please sync the user from AD first.`
        });
      }
    }

    let adSyncSuccess = false;
    let adSyncError = null;

    // Step 1: Update in Active Directory first
    const enableAdSync = process.env.ENABLE_AD_DEPARTMENT_SYNC !== 'false';

    if (enableAdSync) {
      try {
        // Extract OU from DN for logging
        const ouMatch = user.ad_dn.match(/OU=([^,]+)/i);
        const ouName = ouMatch ? ouMatch[1] : 'Unknown OU';

        console.log(`🔄 Updating department attribute in AD for user ${user.username}`);
        console.log(`   User DN: ${user.ad_dn}`);
        console.log(`   User OU: ${ouName}`);
        console.log(`   New department: ${departmentName.trim()}`);

        await ldapService.updateUserAttribute(
          user.ad_dn,
          'department',
          departmentName.trim()
        );

        adSyncSuccess = true;
        console.log(`✅ Successfully updated department in AD for user ${user.username} in OU: ${ouName}`);
      } catch (adError) {
        // Extract OU from DN for error reporting
        const ouMatch = user.ad_dn.match(/OU=([^,]+)/i);
        const ouName = ouMatch ? ouMatch[1] : 'Unknown OU';

        console.error(`❌ Failed to update department in AD for user ${user.username}`);
        console.error(`   User DN: ${user.ad_dn}`);
        console.error(`   User OU: ${ouName}`);
        console.error(`   Error: ${adError.message}`);

        adSyncError = adError.message;

        // If permission error, return error and don't update database
        if (adError.message.includes('Permission denied') ||
          adError.message.includes('INSUFF_ACCESS_RIGHTS') ||
          adError.message.includes('insufficient access')) {
          return res.status(403).json({
            error: 'AD sync failed - Permission denied',
            message: adError.message,
            details: `Cannot update department attribute for users in OU "${ouName}". Your LDAP service account needs write permissions on user objects in this OU. The database was not updated.`,
            userOU: ouName,
            userDN: user.ad_dn
          });
        }

        // For other AD errors, still return error but provide more context
        return res.status(500).json({
          error: 'AD sync failed',
          message: adError.message,
          details: `Failed to update department attribute in AD for user in OU "${ouName}". The database was not updated.`,
          userOU: ouName
        });
      }
    }

    // Step 2: Find or create department in database
    let dbDepartment = null;

    if (departmentId) {
      // Use provided department ID
      dbDepartment = await Department.findByPk(departmentId);

      if (!dbDepartment) {
        return res.status(404).json({
          error: 'Department not found',
          message: 'The specified department does not exist in the database'
        });
      }
    } else {
      // Find or create department by name
      const [department, created] = await Department.findOrCreate({
        where: { name: departmentName.trim() },
        defaults: {
          name: departmentName.trim(),
          description: departmentName.trim(),
          is_active: true,
          ad_dn: null // No OU DN when using attributes
        }
      });

      dbDepartment = department;

      if (created) {
        console.log(`✅ Created new department in database: ${departmentName}`);
      }
    }

    // Step 3: Update user in database
    const oldDepartmentId = user.department_id;
    user.department_id = dbDepartment.id;
    await user.save();

    console.log(`✅ Updated user ${user.username} department in database from ${oldDepartmentId || 'none'} to ${dbDepartment.id}`);

    // Fetch updated user with department
    const updatedUser = await User.findByPk(id, {
      include: [{
        model: Department,
        as: 'Department'
      }],
      attributes: { exclude: ['ad_groups', 'ad_dn'] }
    });

    res.json({
      message: 'User department updated successfully',
      user: {
        id: updatedUser.id,
        username: updatedUser.username,
        email: updatedUser.email,
        firstName: updatedUser.first_name,
        lastName: updatedUser.last_name,
        fullName: updatedUser.getFullName(),
        role: updatedUser.role,
        title: updatedUser.title,
        isActive: updatedUser.is_active,
        department: updatedUser.Department ? {
          id: updatedUser.Department.id,
          name: updatedUser.Department.name,
          description: updatedUser.Department.description
        } : null
      },
      adSync: {
        enabled: enableAdSync,
        success: adSyncSuccess,
        error: adSyncError
      }
    });
  } catch (error) {
    console.error('Error updating user department:', error);
    res.status(500).json({
      error: 'Failed to update user department',
      message: error.message
    });
  }
});

// Activate/Deactivate user (super admin only)
router.patch('/:id/status', authenticateToken, requireRole('super_administrator'), async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    if (typeof isActive !== 'boolean') {
      return res.status(400).json({
        error: 'Invalid status',
        message: 'isActive must be a boolean value'
      });
    }

    const user = await User.findByPk(id);

    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'The requested user does not exist'
      });
    }

    // Prevent deactivating the last super administrator
    if (!isActive && user.role === 'super_administrator') {
      const activeAdmins = await User.count({
        where: {
          role: 'super_administrator',
          is_active: true,
          id: { [Op.ne]: id }
        }
      });

      if (activeAdmins === 0) {
        return res.status(400).json({
          error: 'Cannot deactivate',
          message: 'Cannot deactivate the last super administrator'
        });
      }
    }

    await user.update({ is_active: isActive });

    res.json({
      message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
      user: {
        id: user.id,
        username: user.username,
        isActive: user.is_active
      }
    });
  } catch (error) {
    console.error('Error updating user status:', error);
    res.status(500).json({
      error: 'Failed to update user status',
      message: error.message
    });
  }
});

// Sync all users from AD (super admin only)
router.post('/sync', authenticateToken, requireRole('super_administrator'), async (req, res) => {
  try {
    const result = await userSyncService.syncAllUsers();

    if (result.success) {
      res.json({
        message: 'User synchronization completed successfully',
        syncTime: result.syncTime,
        stats: result.stats
      });
    } else {
      res.status(500).json({
        error: 'User synchronization failed',
        message: result.error,
        stats: result.stats
      });
    }
  } catch (error) {
    console.error('Error syncing users:', error);
    res.status(500).json({
      error: 'Failed to sync users',
      message: error.message
    });
  }
});

// Sync single user from AD (admin and IT manager only)
router.post('/:username/sync', authenticateToken, requireRole('super_administrator', 'it_manager'), async (req, res) => {
  try {
    const { username } = req.params;

    const result = await userSyncService.syncSingleUser(username);

    res.json({
      message: `User ${username} synchronized successfully`,
      user: {
        id: result.user.id,
        username: result.user.username,
        email: result.user.email,
        created: result.created
      }
    });
  } catch (error) {
    console.error('Error syncing single user:', error);

    if (error.message.includes('not found')) {
      return res.status(404).json({
        error: 'User not found',
        message: `User ${req.params.username} not found in Active Directory`
      });
    }

    res.status(500).json({
      error: 'Failed to sync user',
      message: error.message
    });
  }
});

// Get sync status (admin and IT manager only)
router.get('/sync/status', authenticateToken, requireRole('super_administrator', 'it_manager'), (req, res) => {
  try {
    const status = userSyncService.getSyncStatus();
    res.json(status);
  } catch (error) {
    console.error('Error getting sync status:', error);
    res.status(500).json({
      error: 'Failed to get sync status',
      message: error.message
    });
  }
});

// Get users by department (for approvers)
router.get('/department/:departmentId', authenticateToken, async (req, res) => {
  try {
    const { departmentId } = req.params;

    // Check if user can access this department
    if (req.user.role === 'department_approver' && req.user.department_id !== departmentId) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You can only view users from your own department'
      });
    }

    const users = await User.findAll({
      where: {
        department_id: departmentId,
        is_active: true
      },
      include: [{
        model: Department,
        as: 'Department'
      }],
      attributes: { exclude: ['ad_groups', 'ad_dn'] },
      order: [['last_name', 'ASC'], ['first_name', 'ASC']]
    });

    res.json({
      users: users.map(user => ({
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        fullName: user.getFullName(),
        role: user.role,
        title: user.title
      }))
    });
  } catch (error) {
    console.error('Error fetching department users:', error);
    res.status(500).json({
      error: 'Failed to fetch department users',
      message: error.message
    });
  }
});

// Export users to Excel (super admin and IT manager only)
router.get('/export/excel', authenticateToken, requireRole('super_administrator', 'it_manager'), async (req, res) => {
  try {
    const { search, department, role, status } = req.query;

    const filters = {};
    if (search) filters.search = search;
    if (department) filters.department = department;
    if (role) filters.role = role;
    // Map status query parameter to active filter expected by exportService
    if (status) {
      if (status === 'active') {
        filters.active = 'true';
      } else if (status === 'inactive') {
        filters.active = 'false';
      } else {
        filters.active = 'all';
      }
    } else {
      filters.active = 'all'; // Default to all users if no status filter
    }

    const excelBuffer = await exportService.exportUsers(filters);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=users_export_${new Date().toISOString().split('T')[0]}.xlsx`);

    res.send(excelBuffer);
  } catch (error) {
    console.error('Error exporting users:', error);
    res.status(500).json({
      error: 'Failed to export users',
      message: error.message
    });
  }
});

export default router;
