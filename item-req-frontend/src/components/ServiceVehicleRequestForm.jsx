import React, { useState, useEffect } from "react";
import { ArrowLeft, Plus, Trash2, AlertCircle, Save, Send, RotateCcw, CheckCircle, XCircle, Loader } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { validateServiceVehicleForm } from "../helpers/validations";
import { serviceVehicleRequestsAPI, departmentsAPI } from "../services/api";

const REQUEST_TYPE_OPTIONS = [
  { value: "drop_passenger_only", label: "Drop Passenger Only" },
  { value: "point_to_point_service", label: "Point-to-Point Service (Waiting)" },
  { value: "passenger_pickup_only", label: "Passenger Pick-up Only" },
  { value: "item_pickup", label: "Item Pick-up" },
  { value: "item_delivery", label: "Item Delivery" },
  { value: "car_only", label: "Car Only" },
];

export default function ServiceVehicleRequestForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    requestor_name: "",
    date_prepared: "",
    department_id: "",
    contact_number: "",
    purpose: "",
    request_type: "",
    travel_date_from: "",
    travel_date_to: "",
    pick_up_location: "",
    pick_up_time: "",
    drop_off_location: "",
    drop_off_time: "",
    passengers: [{ name: "" }],
    destination: "",
    departure_time: "",
    destination_car: "",
    has_valid_license: "",
    license_number: "",
    expiration_date: "",
    requested_by_signature: "",
    requested_by_date: "",
    item_description: "",
    item_pick_up_location: "",
    item_pick_up_time: "",
    item_drop_off_location: "",
    item_drop_off_time: "",
    item_quantity: "",
    recipient_name: "",
    recipient_contact: "",
    status: "",
    assigned_driver: "",
    assigned_vehicle: "",
    approval_date: "",
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [isODHCUser, setIsODHCUser] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);

  useEffect(() => {
    // Get current user's full name from auth context
    const userFullName =
      user?.firstName + " " + user?.lastName ||
      user?.name ||
      "User";
    
    // Get user data from localStorage and extract department info
    const userData = localStorage.getItem("user");
    let userDepartmentId = "";

    if (userData) {
      try {
        const parsedUser = JSON.parse(userData);
        userDepartmentId = parsedUser.department?.id || "";
      } catch (error) {
        console.error("Error parsing user data from localStorage:", error);
      }
    }

    setFormData((prev) => ({
      ...prev,
      requestor_name: userFullName,
      requested_by_signature: userFullName,
      department_id: userDepartmentId || "",
    }));

    // Check if user is from ODHC department
    if (userData) {
      try {
        const parsedUser = JSON.parse(userData);
        const departmentName = parsedUser.department?.name || '';
        const isODHC = departmentName.toLowerCase().includes('odhc') && parsedUser.role === 'department_approver';
        setIsODHCUser(isODHC);
      } catch (error) {
        console.error("Error parsing user data:", error);
      }
    }

    // Load existing request from database if editing
    if (id) {
      loadFormData(id);
    }
  }, [user, id]);

  const loadFormData = async (requestId) => {
    try {
      setLoading(true);
      const response = await serviceVehicleRequestsAPI.getById(requestId);
      // Extract request object from response if it exists
      const data = response.data.request || response.data;
      console.log("Loaded vehicle request data:", data);
      console.log("Request status:", data.status);
      console.log("User role:", user?.role);
      
      // Ensure passengers is always an array
      // If passengers exists and is an array, use it; otherwise default to empty array with one empty passenger
      if (!data.passengers || !Array.isArray(data.passengers)) {
        // If passengers is a string (old format), convert it
        if (data.passengers && typeof data.passengers === 'string') {
          data.passengers = [{ name: data.passengers }];
        } else {
          // Default to one empty passenger field
          data.passengers = [{ name: "" }];
        }
      } else {
        // Ensure all passenger objects have the name property
        data.passengers = data.passengers.map(p => 
          typeof p === 'string' ? { name: p } : (p && p.name ? p : { name: "" })
        );
        // If array is empty, add one empty passenger
        if (data.passengers.length === 0) {
          data.passengers = [{ name: "" }];
        }
      }
      
      // Map requested_date to requested_by_date for Section 4 signature
      if (data.requested_date && !data.requested_by_date) {
        // Format the date to YYYY-MM-DD if it's a full datetime
        const dateValue = new Date(data.requested_date);
        if (!isNaN(dateValue.getTime())) {
          data.requested_by_date = dateValue.toISOString().split('T')[0];
        }
      }
      
      // Map approval_date to date format if needed
      if (data.approval_date) {
        const approvalDateValue = new Date(data.approval_date);
        if (!isNaN(approvalDateValue.getTime())) {
          data.approval_date = approvalDateValue.toISOString().split('T')[0];
        }
      }
      
      // Ensure all required fields have default values
      setFormData({
        ...formData,
        ...data,
        passengers: data.passengers || [{ name: "" }],
        requested_by_date: data.requested_by_date || (data.requested_date ? new Date(data.requested_date).toISOString().split('T')[0] : ""),
        assigned_driver: data.assigned_driver || '',
        assigned_vehicle: data.assigned_vehicle || '',
        approval_date: data.approval_date || ''
      });

      // Load attachments
      if (data.attachments && Array.isArray(data.attachments)) {
        setAttachments(data.attachments);
      } else {
        setAttachments([]);
      }
    } catch (error) {
      console.error("Error loading form data:", error);
      alert("Error loading request data");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    // Clear error for this field when user starts typing
    if (errors[name]) {
      setErrors({ ...errors, [name]: undefined });
    }
  };

  const handlePassengerChange = (index, field, value) => {
    const currentPassengers = formData.passengers || [{ name: "" }];
    const updatedPassengers = [...currentPassengers];
    updatedPassengers[index][field] = value;
    setFormData({ ...formData, passengers: updatedPassengers });
  };

  const addPassenger = () => {
    const currentPassengers = formData.passengers || [{ name: "" }];
    setFormData({
      ...formData,
      passengers: [
        ...currentPassengers,
        { name: "" },
      ],
    });
  };

  const removePassenger = (index) => {
    const currentPassengers = formData.passengers || [{ name: "" }];
    const updatedPassengers = currentPassengers.filter((_, i) => i !== index);
    setFormData({ ...formData, passengers: updatedPassengers });
  };

  const handleSubmit = async () => {
    // Validate dates before form validation
    const dateFields = ['date_prepared', 'travel_date_from', 'travel_date_to', 'expiration_date'];
    const cleanedFormData = { ...formData, status: 'draft' }; // Save as draft first
    
    dateFields.forEach(field => {
      if (cleanedFormData[field] && cleanedFormData[field].trim() === '') {
        cleanedFormData[field] = null;
      }
    });

    // Validate with submitted status for validation rules
    const validationData = { ...cleanedFormData, status: 'submitted' };
    const validation = validateServiceVehicleForm(validationData);

    if (!validation.isValid) {
      setErrors(validation.errors);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    try {
      setLoading(true);
      setErrors({});

      const dataToSubmit = { ...cleanedFormData };

      let requestId = id;

      if (id) {
        // Update existing request (as draft)
        await serviceVehicleRequestsAPI.update(id, dataToSubmit);
        requestId = id;
      } else {
        // Create new request (as draft)
        const response = await serviceVehicleRequestsAPI.create(dataToSubmit);
        // Handle different response structures - ServiceVehicleRequest uses 'id' field mapped to 'request_id' in DB
        requestId = response.data?.request?.id || 
                   response.data?.request?.request_id ||
                   response.data?.id;
        
        if (!requestId) {
          console.error('Response structure:', response.data);
          throw new Error("Could not determine request ID from response");
        }
      }
      
      // Now submit the request (this will trigger email notifications)
      if (requestId) {
        await serviceVehicleRequestsAPI.submit(requestId);
        setSuccessMessage("Service Vehicle Request submitted successfully!");
      } else {
        throw new Error("Failed to get request ID after creation");
      }
      
      setTimeout(() => {
        navigate("/dashboard");
      }, 2000);
    } catch (error) {
      console.error("Error submitting form:", error);
      
      const errorMessage = 
        error.response?.data?.message || 
        error.response?.data?.errors?.[0]?.msg ||
        error.message || 
        "Error submitting request. Please try again.";
      
      setErrors({ submit: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDraft = async () => {
    try {
      setLoading(true);
      
      const dataToSave = { ...formData, status: 'draft' };
      
      if (id) {
        // Update existing draft
        await serviceVehicleRequestsAPI.update(id, dataToSave);
        setSuccessMessage("Draft updated successfully!");
      } else {
        // Create new draft
        await serviceVehicleRequestsAPI.create(dataToSave);
        setSuccessMessage("Form saved as draft successfully!");
      }

      setTimeout(() => {
        setSuccessMessage("");
      }, 3000);
    } catch (error) {
      console.error("Error saving draft:", error);
      alert(error.response?.data?.message || "Error saving draft");
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (event) => {
    const files = Array.from(event.target.files);
    if (!files.length) return;

    // Check if user is an approver (department_approver or super_administrator)
    if (user?.role !== 'department_approver' && user?.role !== 'super_administrator') {
      alert("Only approvers can upload attachments");
      event.target.value = ''; // Reset file input
      return;
    }

    // Allow uploads for submitted, returned, department_approved, or completed requests
    // ODHC approvers need to upload attachments when status is department_approved (after Step 1 approval)
    if (!['submitted', 'returned', 'department_approved', 'completed'].includes(formData.status)) {
      alert("Attachments can only be uploaded for submitted, returned, department_approved, or completed requests");
      event.target.value = ''; // Reset file input
      return;
    }

    if (!id) {
      alert("Please save the request first before uploading attachments");
      event.target.value = ''; // Reset file input
      return;
    }

    try {
      setUploadingFiles(true);
      const formData = new FormData();
      files.forEach(file => {
        formData.append('files', file);
      });

      const response = await serviceVehicleRequestsAPI.uploadAttachments(id, formData);
      
      if (response.data.success) {
        setAttachments(prev => [...prev, ...response.data.attachments]);
        setSuccessMessage("Files uploaded successfully!");
        setTimeout(() => setSuccessMessage(""), 3000);
      }
    } catch (error) {
      console.error("Error uploading files:", error);
      alert(error.response?.data?.message || "Error uploading files");
    } finally {
      setUploadingFiles(false);
      event.target.value = ''; // Reset file input
    }
  };

  const handleDeleteAttachment = async (filename) => {
    if (!id) return;
    
    if (!window.confirm("Are you sure you want to delete this attachment?")) {
      return;
    }

    try {
      setLoading(true);
      await serviceVehicleRequestsAPI.deleteAttachment(id, filename);
      setAttachments(prev => prev.filter(att => att.filename !== filename));
      setSuccessMessage("Attachment deleted successfully!");
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (error) {
      console.error("Error deleting attachment:", error);
      alert(error.response?.data?.message || "Error deleting attachment");
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const handleSaveSection4 = async () => {
    if (!id) {
      alert("Please save the request first before updating Section 4");
      return;
    }

    try {
      setLoading(true);
      
      const section4Data = {
        assigned_driver: formData.assigned_driver || null,
        assigned_vehicle: formData.assigned_vehicle || null,
        approval_date: formData.approval_date || null,
      };

      // Use the assign endpoint or update endpoint
      await serviceVehicleRequestsAPI.assign(id, section4Data);
      
      setSuccessMessage("Section 4 updated successfully!");
      
      // Reload form data to get updated values
      await loadFormData(id);
      
      setTimeout(() => {
        setSuccessMessage("");
      }, 3000);
    } catch (error) {
      console.error("Error saving Section 4:", error);
      alert(error.response?.data?.message || "Error saving Section 4");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    const confirmCancel = window.confirm(
      "Are you sure you want to cancel? Any unsaved changes will be lost."
    );
    if (confirmCancel) {
      navigate("/dashboard");
    }
  };

  const handleDelete = async () => {
    const confirmDelete = window.confirm(
      "Are you sure you want to delete this draft? This action cannot be undone."
    );
    if (confirmDelete) {
      try {
        setLoading(true);
        if (id) {
          await serviceVehicleRequestsAPI.delete(id);
        }
        alert("Draft deleted successfully!");
        navigate("/dashboard");
      } catch (error) {
        console.error("Error deleting draft:", error);
        alert(error.response?.data?.message || "Error deleting draft");
      } finally {
        setLoading(false);
      }
    }
  };

  const handleApprove = async () => {
    // Validate Section 4 fields before approval ONLY if user is ODHC
    if (isODHCUser) {
      if (!formData.assigned_driver || !formData.assigned_driver.trim()) {
        alert("Please fill in the Assigned Driver field in Section 4 before approving.");
        return;
      }

      if (!formData.assigned_vehicle || !formData.assigned_vehicle.trim()) {
        alert("Please fill in the Assigned Vehicle field in Section 4 before approving.");
        return;
      }

      if (!formData.approval_date) {
        alert("Please fill in the Approval Date field in Section 4 before approving.");
        return;
      }

      // If Section 4 fields are not saved, save them first (only for ODHC users)
      if (id) {
        try {
          setLoading(true);
          await handleSaveSection4();
          // Wait a moment for the save to complete
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
          console.error("Error saving Section 4:", error);
          alert("Error saving Section 4. Please try again.");
          setLoading(false);
          return;
        }
      }
    }
    try {
      setLoading(true);
      const approvalReason = prompt("Please provide approval remarks (optional):");
      
      await serviceVehicleRequestsAPI.approve(id, { 
        remarks: approvalReason || "" 
      });
      
      setSuccessMessage("Request approved and completed successfully!");
      setTimeout(() => {
        navigate("/dashboard");
      }, 2000);
    } catch (error) {
      console.error("Error approving request:", error);
      alert(error.response?.data?.message || "Error approving request");
    } finally {
      setLoading(false);
    }
  };

  const handleReturn = async () => {
    const reason = prompt("Please provide a reason for returning this request:");
    if (reason) {
      try {
        setLoading(true);
        await serviceVehicleRequestsAPI.return(id, { reason });
        setSuccessMessage("Request returned successfully!");
        setTimeout(() => {
          navigate("/dashboard");
        }, 2000);
      } catch (error) {
        console.error("Error returning request:", error);
        alert(error.response?.data?.message || "Error returning request");
      } finally {
        setLoading(false);
      }
    }
  };

  const handleDecline = async () => {
    const reason = prompt("Please provide a reason for declining this request:");
    if (reason) {
      try {
        setLoading(true);
        await serviceVehicleRequestsAPI.decline(id, { reason });
        setSuccessMessage("Request declined successfully!");
        setTimeout(() => {
          navigate("/dashboard");
        }, 2000);
      } catch (error) {
        console.error("Error declining request:", error);
        alert(error.response?.data?.message || "Error declining request");
      } finally {
        setLoading(false);
      }
    }
  };


  // Dynamic conditional section config
  const getConditionalConfig = () => {
    const configs = {
      drop_passenger_only: {
        title: "ACCOMPLISH THIS PART IF REQUEST IS DROP PASSENGER ONLY",
        fields: [
          {
            name: "pick_up_location",
            label: "Pick-Up Location",
            type: "text",
            span: 1,
          },
          {
            name: "pick_up_time",
            label: "Pick-Up Time",
            type: "time",
            span: 1,
          },
          {
            name: "drop_off_location",
            label: "Drop-Off Location",
            type: "text",
            span: 1,
          },
          {
            name: "drop_off_time",
            label: "Drop-Off Time",
            type: "time",
            span: 1,
          },
        ],
        showPassengers: true,
      },
      passenger_pickup_only: {
        title: "ACCOMPLISH THIS PART IF REQUEST IS PASSENGER PICK-UP ONLY",
        fields: [
          {
            name: "pick_up_location",
            label: "Pick-Up Location",
            type: "text",
            span: 1,
          },
          {
            name: "pick_up_time",
            label: "Pick-Up Time",
            type: "time",
            span: 1,
          },
          {
            name: "drop_off_location",
            label: "Drop-Off Location",
            type: "text",
            span: 1,
          },
        ],
        showPassengers: true,
        passengerLabel: "Passengers to Pick Up",
      },
      item_pickup: {
        title: "ACCOMPLISH THIS PART IF REQUEST IS ITEM PICK-UP",
        fields: [
          {
            name: "pick_up_location",
            label: "Pick-Up Location",
            type: "text",
            span: 1,
          },
          {
            name: "pick_up_time",
            label: "Pick-Up Time",
            type: "time",
            span: 1,
          },
          {
            name: "drop_off_location",
            label: "Drop-Off Location",
            type: "text",
            span: 1,
          },
          {
            name: "drop_off_time",
            label: "Drop-Off Time",
            type: "time",
            span: 1,
          },
        ],
        showPassengers: false,
      },
      item_delivery: {
        title: "ACCOMPLISH THIS PART IF REQUEST IS ITEM DELIVERY",
        fields: [
          {
            name: "pick_up_location",
            label: "Pick-Up Location",
            type: "text",
            span: 1,
          },
          {
            name: "pick_up_time",
            label: "Pick-Up Time",
            type: "time",
            span: 1,
          },
          {
            name: "drop_off_location",
            label: "Drop-Off Location",
            type: "text",
            span: 1,
          },
          {
            name: "drop_off_time",
            label: "Drop-Off Time",
            type: "time",
            span: 1,
          },
        ],
        showPassengers: false,
      },
      point_to_point_service: {
        title: "ACCOMPLISH THIS PART IF REQUEST IS POINT-TO-POINT",
        fields: [
          {
            name: "pick_up_location",
            label: "Pick-Up Location",
            type: "text",
            span: 1,
          },
          {
            name: "pick_up_time",
            label: "Pick-Up Time",
            type: "time",
            span: 1,
          },
          {
            name: "drop_off_location",
            label: "Drop-Off Location",
            type: "text",
            span: 1,
          },
          {
            name: "drop_off_time",
            label: "Drop-Off Time",
            type: "time",
            span: 1,
          },
          { name: "destination", label: "Destination", type: "text", span: 2 },
          {
            name: "departure_time",
            label: "Departure Time",
            type: "time",
            span: 1,
          },
        ],
        showPassengers: true,
        passengerLabel: "Passengers",
      },
      car_only: {
        title: "ACCOMPLISH THIS PART IF REQUEST IS CAR ONLY",
        fields: [
          {
            name: "destination_car",
            label: "Destination / Car Use",
            type: "text",
            span: 2,
          },
        ],
        showPassengers: false,
      },
    };
    return configs[formData.request_type] || null;
  };

  const renderConditionalSection = () => {
    const config = getConditionalConfig();
    if (!config) return null;

    return (
      <div className="border-t-2 border-black pt-3 mb-4">
        <h2 className="text-xs font-bold mb-3 bg-gray-200 py-1 px-2">
          {config.title}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-x-8 md:gap-y-2 mb-3">
          {config.fields.map((field) => (
            <div
              key={field.name}
              className={field.span === 2 ? "col-span-1 md:col-span-2" : ""}
            >
              <div className="flex flex-col">
                <div className="flex flex-col sm:flex-row sm:items-center">
                  <label className="text-xs font-semibold w-full sm:w-32 mb-1 sm:mb-0">
                    {field.label}
                  </label>
                  <input
                    type={field.type}
                    name={field.name}
                    value={formData[field.name]}
                    onChange={handleChange}
                    disabled={loading}
                    className={getInputClassName(
                      field.name,
                      "flex-1 border-b border-black px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                    )}
                  />
                </div>
                {renderFieldError(field.name)}
              </div>
            </div>
          ))}
        </div>

        {/* Passengers Section */}
        {config.showPassengers && (
          <div className="border-t border-gray-300 pt-3 mt-3">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-xs font-bold">
                {config.passengerLabel || "Passengers"}
              </h3>
              <button
                onClick={addPassenger}
                disabled={loading}
                className="flex items-center gap-1 bg-green-600 text-white px-3 py-1 text-xs rounded hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                <Plus size={14} />
                Add Passenger
              </button>
            </div>

            {(formData.passengers || []).map((passenger, index) => (
              <div
                key={index}
                className="bg-gray-50 p-3 mb-3 rounded border border-gray-200"
              >
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-semibold">
                    Passenger {index + 1}
                  </span>
                  {formData.passengers.length > 1 && (
                    <button
                      onClick={() => removePassenger(index)}
                      disabled={loading}
                      className="flex items-center gap-1 bg-red-600 text-white px-2 py-1 text-xs rounded hover:bg-red-700 transition-colors disabled:opacity-50"
                    >
                      <Trash2 size={12} />
                      Remove
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="flex flex-col">
                    <label className="text-xs font-semibold mb-1">Name</label>
                    <input
                      type="text"
                      value={passenger.name}
                      onChange={(e) =>
                        handlePassengerChange(index, "name", e.target.value)
                      }
                      disabled={loading}
                      className="border border-black px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                    />
                  </div>
                </div>
              </div>
            ))}
            {renderFieldError("passengers")}
          </div>
        )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-white py-2 md:py-4 lg:py-8 px-2 md:px-3 lg:px-4">
      <div className="max-w-5xl mx-auto">
        {/* Top Navigation */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-3 mb-3 md:mb-4 lg:mb-6">
          <button
            onClick={() => navigate("/dashboard")}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 font-semibold text-xs sm:text-sm md:text-base transition-colors"
          >
            <ArrowLeft size={18} className="sm:w-5 sm:h-5" />
            <span className="hidden sm:inline">Back to Dashboard</span>
            <span className="sm:hidden">Back</span>
          </button>
          <h1 className="text-sm sm:text-base md:text-lg lg:text-xl font-bold text-gray-800 order-first sm:order-none w-full sm:w-auto text-center sm:text-center">
            STC Packaging Solutions
          </h1>

          <div className="hidden lg:block w-20"></div>
        </div>

        {/* Success Message */}
        {successMessage && (
          <div className="mb-4 p-3 bg-green-50 border border-green-300 rounded">
            <p className="text-xs sm:text-sm text-green-700 font-semibold">{successMessage}</p>
          </div>
        )}

        {/* Loading Spinner */}
        {loading && (
          <div className="flex items-center justify-center mb-4">
            <Loader size={20} className="animate-spin text-blue-600 mr-2" />
            <span className="text-xs sm:text-sm text-gray-600">Processing...</span>
          </div>
        )}

        <div className="bg-white border-2 border-black overflow-x-auto">
          {/* Header */}
          <div className="bg-gray-800 text-white p-2 sm:p-3 md:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <h1 className="text-base sm:text-lg md:text-xl font-bold">
              Service Vehicle Request Forms
            </h1>

            <p className="text-xs text-gray-100 whitespace-nowrap">HRD-FM-035 rev.04 073025</p>
          </div>

          {/* Reminders */}
          <div className="border-b-2 border-black p-2 sm:p-3 md:p-4">
            <h2 className="font-bold text-xs sm:text-sm mb-2">Reminders:</h2>
            <ol className="text-xs space-y-1 ml-4 list-decimal">
              <li >
                Request for service vehicle must be planned and must be filed at
                least one (1) business day before the planned travel. Cut-off
                time for filing of request is at 4pm, Mondays to Fridays.
              </li>
              <li>
                For cancellation, notify General Services at least one (1) hour
                before the scheduled travel.
              </li>
            </ol>
          </div>

          <div className="p-2 sm:p-3 md:p-4">
         

            {/* Submit Error */}
            {errors.submit && (
              <div className="mb-3 p-2 sm:p-3 bg-red-50 border border-red-300 rounded">
                <p className="text-xs sm:text-sm text-red-600">{errors.submit}</p>
              </div>
            )}

            {/* Requestor Information */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 md:gap-x-8 md:gap-y-2 mb-3 md:mb-4">
              <div className="flex flex-col">
                <label className="text-xs font-semibold mb-1">
                  Requestor
                </label>
                <input
                  type="text"
                  name="requestor_name"
                  value={formData.requestor_name}
                  readOnly
                  className="border-b border-black px-2 py-1 text-xs focus:outline-none bg-gray-100 cursor-not-allowed"
                />
              </div>
              <div className="flex flex-col">
                <label className="text-xs font-semibold mb-1">
                  Date Prepared
                </label>
                <input
                  type="date"
                  name="date_prepared"
                  value={formData.date_prepared}
                  onChange={handleChange}
                  disabled={loading}
                  className={getInputClassName(
                    "date_prepared",
                    "border-b border-black px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  )}
                />
                {renderFieldError("date_prepared")}
              </div>
              <div className="flex flex-col">
                <label className="text-xs font-semibold mb-1">
                  Function / Department
                </label>
                <input
                  type="text"
                  name="department_id"
                  value={
                    (() => {
                      const userData = localStorage.getItem("user");
                      if (userData) {
                        try {
                          const parsedUser = JSON.parse(userData);
                          return parsedUser.department?.name || "";
                        } catch (error) {
                          return "";
                        }
                      }
                      return "";
                    })()
                  }
                  readOnly
                  className="border-b border-black px-2 py-1 text-xs focus:outline-none bg-gray-100 cursor-not-allowed"
                />
              </div>
              <div className="flex flex-col">
                <label className="text-xs font-semibold mb-1">
                  Contact Number
                </label>
                <input
                  type="tel"
                  name="contact_number"
                  value={formData.contact_number}
                  onChange={handleChange}
                  disabled={loading}
                  className={getInputClassName(
                    "contact_number",
                    "border-b border-black px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  )}
                />
                {renderFieldError("contact_number")}
              </div>
            </div>

            {/* Purpose */}
            <div className="mb-3 md:mb-4 flex flex-col">
              <label className="text-xs font-semibold block mb-1">
                Purpose of Request
              </label>
              <textarea
                name="purpose"
                value={formData.purpose}
                onChange={handleChange}
                disabled={loading}
                rows="2"
                className={getInputClassName(
                  "purpose",
                  "w-full border border-black px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                )}
              ></textarea>
              {renderFieldError("purpose")}
            </div>

            {/* Request Type */}
            <div className="mb-3 md:mb-4 flex flex-col">
              <label className="text-xs font-semibold block mb-1">
                Type of Request
              </label>
              <select
                name="request_type"
                value={formData.request_type}
                onChange={handleChange}
                disabled={loading}
                className={getInputClassName(
                  "request_type",
                  "w-full border border-black px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                )}
              >
                <option value="" disabled>
                  Select Request Type
                </option>
                {REQUEST_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {renderFieldError("request_type")}
            </div>

            {/* Travel Dates */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 md:gap-x-8 md:gap-y-2 mb-3 md:mb-4">
              <div className="flex flex-col">
                <label className="text-xs font-semibold mb-1">
                  Travel Date From
                </label>
                <input
                  type="date"
                  name="travel_date_from"
                  value={formData.travel_date_from}
                  onChange={handleChange}
                  disabled={loading}
                  className={getInputClassName(
                    "travel_date_from",
                    "border-b border-black px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  )}
                />
                {renderFieldError("travel_date_from")}
              </div>
              <div className="flex flex-col">
                <label className="text-xs font-semibold mb-1">
                  Travel Date To
                </label>
                <input
                  type="date"
                  name="travel_date_to"
                  value={formData.travel_date_to}
                  onChange={handleChange}
                  disabled={loading}
                  className={getInputClassName(
                    "travel_date_to",
                    "border-b border-black px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  )}
                />
                {renderFieldError("travel_date_to")}
              </div>
            </div>

            {/* Dynamic Conditional Section */}
            {renderConditionalSection()}

            {/* Section 3: Driver's License Information - Only for car_only request type */}
            {formData.request_type === "car_only" && (
              <div className="border border-gray-400 p-4 mb-6">
                <div className="bg-gray-100 -m-4 mb-4 px-4 py-2 border-b border-gray-400">
                  <h2 className="text-sm font-bold text-gray-900 uppercase">Section 3: Driver's License Information</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Do you have a valid Driver's License?
                    </label>
                    <select
                      name="has_valid_license"
                      value={formData.has_valid_license}
                      onChange={handleChange}
                      disabled={loading}
                      className="border-b border-black px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                    >
                      <option value="" disabled>
                        Select
                      </option>
                      <option value="true">Yes</option>
                      <option value="false">No</option>
                    </select>
                  </div>
                  <div className="flex flex-col">
                    <label className="text-xs font-semibold mb-1">
                      License Number
                    </label>
                    <input
                      type="text"
                      name="license_number"
                      value={formData.license_number}
                      onChange={handleChange}
                      disabled={
                        loading ||
                        formData.has_valid_license === "false" ||
                        formData.has_valid_license === ""
                      }
                      className={getInputClassName(
                        "license_number",
                        `border-b border-black px-2 py-1 text-xs focus:outline-none ${
                          formData.has_valid_license === "false" ||
                          formData.has_valid_license === ""
                            ? "bg-gray-100 cursor-not-allowed"
                            : "focus:ring-1 focus:ring-blue-500"
                        } disabled:bg-gray-100 disabled:cursor-not-allowed`
                      )}
                    />
                    {renderFieldError("license_number")}
                  </div>
                  <div className="flex flex-col col-span-1 sm:col-span-2">
                    <label className="text-xs font-semibold mb-1">
                      License Expiration Date
                    </label>
                    <input
                      type="date"
                      name="expiration_date"
                      value={formData.expiration_date}
                      onChange={handleChange}
                      disabled={
                        loading ||
                        formData.has_valid_license === "false" ||
                        formData.has_valid_license === ""
                      }
                      className={getInputClassName(
                        "expiration_date",
                        `border-b border-black px-2 py-1 text-xs focus:outline-none ${
                          formData.has_valid_license === "false" ||
                          formData.has_valid_license === ""
                            ? "bg-gray-100 cursor-not-allowed"
                            : "focus:ring-1 focus:ring-blue-500"
                        } disabled:bg-gray-100 disabled:cursor-not-allowed`
                      )}
                    />
                    {renderFieldError("expiration_date")}
                  </div>
                </div>
              </div>
            )}

            {/* Requested By Section */}
            <div className="border-t-2 border-black mt-4 md:mt-6 pt-2 sm:pt-3 mb-4 md:mb-6">
              <h2 className="text-xs font-bold mb-2 sm:mb-3 bg-gray-200 py-1 px-2">
                REQUESTED BY
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 md:gap-x-8 md:gap-y-2">
                <div className="flex flex-col">
                  <input
                    type="text"
                    name="requested_by_signature"
                    value={formData.requested_by_signature}
                    readOnly
                    className="border-b border-black text-center px-2 py-1 text-xs focus:outline-none bg-gray-100 cursor-not-allowed"
                  />
                  <p className="text-xs text-center text-gray-600 mt-1">
                    Name and Signature
                  </p>
                </div>
                <div className="flex flex-col">
                  <input
                    type="date"
                    name="requested_by_date"
                    value={formData.requested_by_date}
                    onChange={handleChange}
                    disabled={loading}
                    className={getInputClassName(
                      "requested_by_date",
                      "border-b border-black text-center px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                    )}
                  />
                  <p className="text-xs text-center text-gray-600 mt-1">Date</p>
                  {renderFieldError("requested_by_date")}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t-2 border-black mt-4 md:mt-6 pt-2 sm:pt-3">
              <h2 className="text-xs font-bold mb-2 sm:mb-3 bg-gray-200 py-1 px-2">
                TO BE ACCOMPLISHED BY OD & HUMAN CAPITAL – GENERAL SERVICES
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 md:gap-x-8 md:gap-y-2 mb-3">
                <div className="flex flex-col">
                  <label className="text-xs font-semibold mb-1">
                    Reference Code
                  </label>
                  <div className="border-b border-black px-2 py-1 text-xs"></div>
                </div>
                <div className="flex flex-col">
                  <label className="text-xs font-semibold mb-1">
                    Assigned Driver
                  </label>
                  <div className="border-b border-black px-2 py-1 text-xs"></div>
                </div>
                <div className="flex flex-col">
                  <label className="text-xs font-semibold mb-1">
                    Approval Date
                  </label>
                  <div className="border-b border-black px-2 py-1 text-xs"></div>
                </div>
                <div className="flex flex-col">
                  <label className="text-xs font-semibold mb-1">
                    Assigned Vehicle
                  </label>
                  <div className="border-b border-black px-2 py-1 text-xs"></div>
                </div>
              </div>
              <p className="text-xs text-right text-gray-600 mt-2">
                HRD-FM-035 rev.04 073025
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="max-w-5xl mx-auto mt-4 md:mt-6 px-2 md:px-3 lg:px-4">
        <div className="flex flex-col justify-end sm:flex-row flex-wrap gap-2 sm:gap-3 pt-3 sm:pt-4 md:pt-6 border-t-2 border-gray-400">
          <button
            type="button"
            onClick={handleCancel}
            disabled={loading}
            className="w-full sm:w-auto px-4 sm:px-6 py-2 border-2 border-gray-400 rounded text-gray-700 hover:bg-gray-50 text-xs sm:text-sm font-semibold transition-colors disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={loading}
            className="w-full sm:w-auto flex items-center justify-center sm:justify-start gap-2 px-4 sm:px-6 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 text-xs sm:text-sm font-semibold transition-colors disabled:opacity-50"
          >
            <Save size={14} className="sm:w-4 sm:h-4" />
            Save Draft
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="w-full sm:w-auto flex items-center justify-center sm:justify-start gap-2 px-4 sm:px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs sm:text-sm font-semibold transition-colors disabled:opacity-50"
          >
            {loading ? <Loader size={14} className="animate-spin sm:w-4 sm:h-4" /> : <Send size={14} className="sm:w-4 sm:h-4" />}
            Submit Request
          </button>

          {/* HR/Admin Actions - Only visible to HR users */}
          {user?.role === "hr_manager" || user?.role === "admin" ? (
            <>
              <button
                type="button"
                onClick={handleReturn}
                disabled={loading || !id}
                className="w-full sm:w-auto flex items-center justify-center sm:justify-start gap-2 px-4 sm:px-6 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 text-xs sm:text-sm font-semibold transition-colors disabled:opacity-50"
              >
                <RotateCcw size={14} className="sm:w-4 sm:h-4" />
                Return
              </button>

              <button
                type="button"
                onClick={handleDecline}
                disabled={loading || !id}
                className="w-full sm:w-auto flex items-center justify-center sm:justify-start gap-2 px-4 sm:px-6 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-xs sm:text-sm font-semibold transition-colors disabled:opacity-50"
              >
                <XCircle size={14} className="sm:w-4 sm:h-4" />
                Decline
              </button>

              <button
                type="button"
                onClick={handleApprove}
                disabled={loading || !id}
                className="w-full sm:w-auto flex items-center justify-center sm:justify-start gap-2 px-4 sm:px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-xs sm:text-sm font-semibold transition-colors disabled:opacity-50"
              >
                <CheckCircle size={14} className="sm:w-4 sm:h-4" />
                Approve
              </button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
