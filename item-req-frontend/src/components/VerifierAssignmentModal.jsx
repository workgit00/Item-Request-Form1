import React, { useState, useEffect } from 'react';
import { X, Search, User } from 'lucide-react';
import { usersAPI } from '../services/api';

const VerifierAssignmentModal = ({ isOpen, onClose, onAssign, loading: parentLoading }) => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedUserId, setSelectedUserId] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

    // Reset selection when modal opens
    useEffect(() => {
        if (isOpen) {
            setSelectedUserId(null);
            if (searchTerm !== '') {
                setSearchTerm('');
            }
        }
    }, [isOpen]);

    // Debounced search
    useEffect(() => {
        if (!isOpen) return;

        const delaySearch = setTimeout(() => {
            loadUsers(searchTerm);
        }, 300);

        return () => clearTimeout(delaySearch);
    }, [searchTerm, isOpen]);

    const loadUsers = async (search = '') => {
        try {
            setLoading(true);
            const params = { limit: 100 };
            if (search) params.search = search;

            const response = await usersAPI.getAll(params);
            setUsers(response.data.users || []);
        } catch (error) {
            console.error('Error loading users:', error);
            setUsers([]);
        } finally {
            setLoading(false);
        }
    };

    // Users are fetched filtered from the server
    const filteredUsers = users;

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                <div className="fixed inset-0 transition-opacity" aria-hidden="true">
                    <div className="absolute inset-0 bg-gray-500 opacity-75" onClick={onClose}></div>
                </div>

                <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

                <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                    <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                        <div className="sm:flex sm:items-start">
                            <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                                        Assign Temporary Verifier
                                    </h3>
                                    <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
                                        <X className="h-6 w-6" />
                                    </button>
                                </div>

                                <div className="mt-2">
                                    <p className="text-sm text-gray-500 mb-4">
                                        Select a user to grant temporary access to verify this request.
                                    </p>

                                    <div className="relative mb-3">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <Search className="h-4 w-4 text-gray-400" />
                                        </div>
                                        <input
                                            type="text"
                                            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                            placeholder="Search users..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                        />
                                    </div>

                                    <div className="border border-gray-200 rounded-md max-h-60 overflow-y-auto">
                                        {loading ? (
                                            <div className="p-4 text-center text-sm text-gray-500">Loading users...</div>
                                        ) : filteredUsers.length === 0 ? (
                                            <div className="p-4 text-center text-sm text-gray-500">No users found</div>
                                        ) : (
                                            <ul className="divide-y divide-gray-200">
                                                {filteredUsers.map(user => (
                                                    <li
                                                        key={user.id}
                                                        className={`p-3 cursor-pointer hover:bg-blue-50 transition-colors ${selectedUserId === user.id ? 'bg-blue-50 ring-1 ring-inset ring-blue-500' : ''}`}
                                                        onClick={() => setSelectedUserId(user.id)}
                                                    >
                                                        <div className="flex items-center">
                                                            <div className="flex-shrink-0 h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-500">
                                                                <User className="h-4 w-4" />
                                                            </div>
                                                            <div className="ml-3">
                                                                <p className="text-sm font-medium text-gray-900">
                                                                    {user.first_name} {user.last_name}
                                                                </p>
                                                                <p className="text-xs text-gray-500">{user.email || user.username}</p>
                                                            </div>
                                                        </div>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                        <button
                            type="button"
                            className={`w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm ${(!selectedUserId || parentLoading) ? 'opacity-50 cursor-not-allowed' : ''}`}
                            onClick={() => selectedUserId && onAssign(selectedUserId)}
                            disabled={!selectedUserId || parentLoading}
                        >
                            {parentLoading ? 'Assigning...' : 'Assign User'}
                        </button>
                        <button
                            type="button"
                            className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                            onClick={onClose}
                            disabled={parentLoading}
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default VerifierAssignmentModal;
