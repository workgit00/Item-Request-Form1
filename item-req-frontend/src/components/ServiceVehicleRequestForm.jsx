import React, { useState, useEffect } from "react";
import { ArrowLeft, Plus, Trash2, Save, Send, RotateCcw, CheckCircle, XCircle } from "lucide-react";
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
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

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
      setFormData(data);
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
    const updatedPassengers = [...formData.passengers];
    updatedPassengers[index][field] = value;
    setFormData({ ...formData, passengers: updatedPassengers });
  };

  const addPassenger = () => {
    setFormData({
      ...formData,
      passengers: [
        ...formData.passengers,
        { name: "" },
      ],
    });
  };

  const removePassenger = (index) => {
    const updatedPassengers = formData.passengers.filter((_, i) => i !== index);
    setFormData({ ...formData, passengers: updatedPassengers });
  };

  const handleSubmit = async () => {
    // Validate dates before form validation
    const dateFields = ['date_prepared', 'travel_date_from', 'travel_date_to', 'expiration_date'];
    const cleanedFormData = { ...formData, status: 'submitted' };
    
    dateFields.forEach(field => {
      if (cleanedFormData[field] && cleanedFormData[field].trim() === '') {
        cleanedFormData[field] = null;
      }
    });

    const validation = validateServiceVehicleForm(cleanedFormData);

    if (!validation.isValid) {
      setErrors(validation.errors);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    try {
      setLoading(true);
      setErrors({});

      const dataToSubmit = { ...cleanedFormData };

      if (id) {
        // Update existing request
        await serviceVehicleRequestsAPI.update(id, dataToSubmit);
        setSuccessMessage("Request submitted successfully!");
      } else {
        // Create new request  
        await serviceVehicleRequestsAPI.create(dataToSubmit);
        setSuccessMessage("Service Vehicle Request submitted successfully!");
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
    try {
      setLoading(true);
      const approvalReason = prompt("Please provide approval remarks (optional):");
      
      await serviceVehicleRequestsAPI.approve(id, { 
        remarks: approvalReason || "" 
      });
      
      setSuccessMessage("Request approved successfully!");
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
          { name: "destination", label: "Destination", type: "text", span: 2 },
          {
            name: "departure_time",
            label: "Departure Time",
            type: "time",
            span: 1,
          },
        ],
        showPassengers: false,
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
      <div className="border border-gray-400 p-4 mb-6">
        <div className="bg-gray-100 -m-4 mb-4 px-4 py-2 border-b border-gray-400">
          <h2 className="text-sm font-bold text-gray-900 uppercase">{config.title}</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
          {config.fields.map((field) => (
            <div
              key={field.name}
              className={field.span === 2 ? "col-span-1 md:col-span-2" : ""}
            >
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                {field.label}
              </label>
              <div className={`border-b-2 pb-1 ${errors[field.name] ? 'border-red-500' : 'border-gray-400'}`}>
                <input
                  type={field.type}
                  name={field.name}
                  value={formData[field.name] || ''}
                  {...getInputProps({
                    onChange: handleChange,
                    className: "w-full bg-transparent border-0 focus:outline-none text-sm",
                    placeholder: `Enter ${field.label.toLowerCase()}`
                  })}
                />
              </div>
              {errors[field.name] && (
                <p className="text-red-500 text-xs mt-1">{errors[field.name]}</p>
              )}
            </div>
          ))}
        </div>

        {/* Passengers Section */}
        {config.showPassengers && (
          <div className="mt-6">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-sm font-semibold text-gray-900">
                {config.passengerLabel || "Passengers"}
              </h3>
              {!isViewing && (
                <button
                  type="button"
                  onClick={addPassenger}
                  disabled={loading}
                  className="flex items-center text-blue-600 hover:text-blue-800 text-sm"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Passenger
                </button>
              )}
            </div>

            {formData.passengers.map((passenger, index) => (
              <div
                key={index}
                className="border border-gray-300 p-3 mb-3 bg-gray-50"
              >
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-semibold text-gray-700">
                    Passenger {index + 1}
                  </span>
                  {!isViewing && formData.passengers.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removePassenger(index)}
                      disabled={loading}
                      className="text-red-600 hover:text-red-800"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Name</label>
                  <div className="border-b-2 border-gray-400 pb-1">
                    <input
                      type="text"
                      value={passenger.name || ''}
                      {...getInputProps({
                        onChange: (e) => handlePassengerChange(index, "name", e.target.value),
                        className: "w-full bg-transparent border-0 focus:outline-none text-sm",
                        placeholder: "Passenger name"
                      })}
                    />
                  </div>
                </div>
              </div>
            ))}
            {errors.passengers && (
              <p className="text-red-500 text-xs mt-1">{errors.passengers}</p>
            )}
          </div>
        )}
      </div>
    );
  };

  if (loading && !id) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const currentPath = window.location.pathname;
  const isEditing = currentPath.includes('/edit');
  const isViewing = !!id && !isEditing;

  const getInputProps = (baseProps = {}) => {
    if (isViewing) {
      return {
        ...baseProps,
        disabled: true,
        className: `${baseProps.className || ''} bg-gray-50`.trim()
      };
    }
    return baseProps;
  };

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      {/* Back Button */}
      <div className="max-w-4xl mx-auto mb-4 px-4">
        <button
          onClick={() => navigate('/dashboard')}
          className="flex items-center text-gray-600 hover:text-gray-800"
        >
          <ArrowLeft className="h-5 w-5 mr-1" />
          Back to Dashboard
        </button>
      </div>

      {/* PDF-like Form Container */}
      <div className="max-w-4xl mx-auto bg-white shadow-2xl" style={{ boxShadow: '0 0 30px rgba(0,0,0,0.15)' }}>
        <div className="p-8 md:p-12" style={{ minHeight: '11in' }}>
          {/* Header Section */}
          <div className="border-b-2 border-gray-800 pb-4 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="w-16 h-16 bg-blue-600 flex items-center justify-center text-white font-bold text-xl">
                  STC
                </div>
                <div>
                  <div className="text-xl font-bold text-gray-900">STYROTECH CORPORATION</div>
                  <div className="text-sm text-gray-600">Packaging Solutions</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-gray-500">Form No.</div>
                <div className="text-sm font-semibold text-gray-700">HRD-FM-035 rev.04</div>
              </div>
            </div>
            <div className="text-center">
              <h1 className="text-2xl font-bold text-gray-900 uppercase tracking-wide">
                Service Vehicle Request Form
              </h1>
              {id && (
                <div className="text-sm text-gray-600 mt-2">
                  Request ID: <span className="font-semibold">{id}</span>
                </div>
              )}
            </div>
          </div>

          {/* Reminders Section */}
          <div className="border border-gray-400 p-4 mb-6 bg-yellow-50">
            <div className="bg-gray-100 -m-4 mb-4 px-4 py-2 border-b border-gray-400">
              <h2 className="text-sm font-bold text-gray-900 uppercase">Reminders</h2>
            </div>
            <ol className="text-xs space-y-1 ml-4 list-decimal text-gray-700">
              <li>
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

          {/* Error Display */}
          {errors.submit && (
            <div className="bg-red-50 border-2 border-red-400 p-4 mb-4">
              <p className="text-red-600 text-sm">{errors.submit}</p>
            </div>
          )}

          {/* Success Message */}
          {successMessage && (
            <div className="bg-green-50 border-2 border-green-400 p-4 mb-4">
              <p className="text-green-700 text-sm font-semibold">{successMessage}</p>
            </div>
          )}

          {/* Form */}
          <form className="space-y-6">
         

            {/* Section 1: Requestor Information */}
            <div className="border border-gray-400 p-4 mb-6">
              <div className="bg-gray-100 -m-4 mb-4 px-4 py-2 border-b border-gray-400">
                <h2 className="text-sm font-bold text-gray-900 uppercase">Section 1: Requestor Information</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Requestor <span className="text-red-600">*</span>
                  </label>
                  <div className="border-b-2 border-gray-400 pb-1">
                    <input
                      type="text"
                      name="requestor_name"
                      value={formData.requestor_name}
                      readOnly
                      className="w-full bg-transparent border-0 focus:outline-none text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Date Prepared
                  </label>
                  <div className={`border-b-2 pb-1 ${errors.date_prepared ? 'border-red-500' : 'border-gray-400'}`}>
                    <input
                      type="date"
                      name="date_prepared"
                      value={formData.date_prepared}
                      {...getInputProps({
                        onChange: handleChange,
                        className: "w-full bg-transparent border-0 focus:outline-none text-sm"
                      })}
                    />
                  </div>
                  {errors.date_prepared && (
                    <p className="text-red-500 text-xs mt-1">{errors.date_prepared}</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Department <span className="text-red-600">*</span>
                  </label>
                  <div className="border-b-2 border-gray-400 pb-1">
                    <input
                      type="text"
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
                      className="w-full bg-transparent border-0 focus:outline-none text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Contact Number
                  </label>
                  <div className={`border-b-2 pb-1 ${errors.contact_number ? 'border-red-500' : 'border-gray-400'}`}>
                    <input
                      type="tel"
                      name="contact_number"
                      value={formData.contact_number}
                      {...getInputProps({
                        onChange: handleChange,
                        className: "w-full bg-transparent border-0 focus:outline-none text-sm",
                        placeholder: "Contact number"
                      })}
                    />
                  </div>
                  {errors.contact_number && (
                    <p className="text-red-500 text-xs mt-1">{errors.contact_number}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Section 2: Request Details */}
            <div className="border border-gray-400 p-4 mb-6">
              <div className="bg-gray-100 -m-4 mb-4 px-4 py-2 border-b border-gray-400">
                <h2 className="text-sm font-bold text-gray-900 uppercase">Section 2: Request Details</h2>
              </div>
              <div className="space-y-6">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Purpose of Request
                  </label>
                  <div className={`border-b-2 pb-1 ${errors.purpose ? 'border-red-500' : 'border-gray-400'}`}>
                    <textarea
                      name="purpose"
                      value={formData.purpose}
                      {...getInputProps({
                        onChange: handleChange,
                        className: "w-full bg-transparent border-0 focus:outline-none text-sm",
                        rows: 3,
                        placeholder: "Explain the purpose of this vehicle request..."
                      })}
                    />
                  </div>
                  {errors.purpose && (
                    <p className="text-red-500 text-xs mt-1">{errors.purpose}</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Type of Request <span className="text-red-600">*</span>
                  </label>
                  <div className={`border-b-2 pb-1 ${errors.request_type ? 'border-red-500' : 'border-gray-400'}`}>
                    <select
                      name="request_type"
                      value={formData.request_type}
                      {...getInputProps({
                        onChange: handleChange,
                        className: "w-full bg-transparent border-0 focus:outline-none text-sm"
                      })}
                    >
                      <option value="">Select Request Type</option>
                      {REQUEST_TYPE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  {errors.request_type && (
                    <p className="text-red-500 text-xs mt-1">{errors.request_type}</p>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Travel Date From
                    </label>
                    <div className={`border-b-2 pb-1 ${errors.travel_date_from ? 'border-red-500' : 'border-gray-400'}`}>
                      <input
                        type="date"
                        name="travel_date_from"
                        value={formData.travel_date_from}
                        {...getInputProps({
                          onChange: handleChange,
                          className: "w-full bg-transparent border-0 focus:outline-none text-sm"
                        })}
                      />
                    </div>
                    {errors.travel_date_from && (
                      <p className="text-red-500 text-xs mt-1">{errors.travel_date_from}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Travel Date To
                    </label>
                    <div className={`border-b-2 pb-1 ${errors.travel_date_to ? 'border-red-500' : 'border-gray-400'}`}>
                      <input
                        type="date"
                        name="travel_date_to"
                        value={formData.travel_date_to}
                        {...getInputProps({
                          onChange: handleChange,
                          className: "w-full bg-transparent border-0 focus:outline-none text-sm"
                        })}
                      />
                    </div>
                    {errors.travel_date_to && (
                      <p className="text-red-500 text-xs mt-1">{errors.travel_date_to}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Section 3: Request Type Specific Details */}
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
                    <div className="border-b-2 border-gray-400 pb-1">
                      <select
                        name="has_valid_license"
                        value={formData.has_valid_license}
                        {...getInputProps({
                          onChange: handleChange,
                          className: "w-full bg-transparent border-0 focus:outline-none text-sm"
                        })}
                      >
                        <option value="">Select</option>
                        <option value="true">Yes</option>
                        <option value="false">No</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      License Number
                    </label>
                    <div className={`border-b-2 pb-1 ${errors.license_number ? 'border-red-500' : 'border-gray-400'}`}>
                      <input
                        type="text"
                        name="license_number"
                        value={formData.license_number || ''}
                        {...getInputProps({
                          onChange: handleChange,
                          disabled: formData.has_valid_license === "false" || formData.has_valid_license === "",
                          className: "w-full bg-transparent border-0 focus:outline-none text-sm"
                        })}
                      />
                    </div>
                    {errors.license_number && (
                      <p className="text-red-500 text-xs mt-1">{errors.license_number}</p>
                    )}
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      License Expiration Date
                    </label>
                    <div className={`border-b-2 pb-1 ${errors.expiration_date ? 'border-red-500' : 'border-gray-400'}`}>
                      <input
                        type="date"
                        name="expiration_date"
                        value={formData.expiration_date || ''}
                        {...getInputProps({
                          onChange: handleChange,
                          disabled: formData.has_valid_license === "false" || formData.has_valid_license === "",
                          className: "w-full bg-transparent border-0 focus:outline-none text-sm"
                        })}
                      />
                    </div>
                    {errors.expiration_date && (
                      <p className="text-red-500 text-xs mt-1">{errors.expiration_date}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Section 4: Requested By */}
            <div className="border border-gray-400 p-4 mb-6">
              <div className="bg-gray-100 -m-4 mb-4 px-4 py-2 border-b border-gray-400">
                <h2 className="text-sm font-bold text-gray-900 uppercase">Section 4: Requested By</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Name and Signature
                  </label>
                  <div className="border-b-2 border-gray-400 pb-1">
                    <input
                      type="text"
                      name="requested_by_signature"
                      value={formData.requested_by_signature}
                      readOnly
                      className="w-full bg-transparent border-0 focus:outline-none text-sm text-center"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Date
                  </label>
                  <div className={`border-b-2 pb-1 ${errors.requested_by_date ? 'border-red-500' : 'border-gray-400'}`}>
                    <input
                      type="date"
                      name="requested_by_date"
                      value={formData.requested_by_date || ''}
                      {...getInputProps({
                        onChange: handleChange,
                        className: "w-full bg-transparent border-0 focus:outline-none text-sm text-center"
                      })}
                    />
                  </div>
                  {errors.requested_by_date && (
                    <p className="text-red-500 text-xs mt-1">{errors.requested_by_date}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Section 5: General Services Section */}
            <div className="border border-gray-400 p-4 mb-6">
              <div className="bg-gray-100 -m-4 mb-4 px-4 py-2 border-b border-gray-400">
                <h2 className="text-sm font-bold text-gray-900 uppercase">Section 5: To Be Accomplished By OD & Human Capital – General Services</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Reference Code
                  </label>
                  <div className="border-b-2 border-gray-400 pb-1">
                    <div className="w-full bg-transparent text-sm text-gray-500">-</div>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Assigned Driver
                  </label>
                  <div className="border-b-2 border-gray-400 pb-1">
                    <div className="w-full bg-transparent text-sm text-gray-500">-</div>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Approval Date
                  </label>
                  <div className="border-b-2 border-gray-400 pb-1">
                    <div className="w-full bg-transparent text-sm text-gray-500">-</div>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Assigned Vehicle
                  </label>
                  <div className="border-b-2 border-gray-400 pb-1">
                    <div className="w-full bg-transparent text-sm text-gray-500">-</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end space-x-4 pt-6 border-t-2 border-gray-400 mt-8">
              <button
                type="button"
                onClick={handleCancel}
                disabled={loading}
                className="px-6 py-2 border-2 border-gray-400 rounded text-gray-700 hover:bg-gray-50 text-sm font-semibold"
              >
                Cancel
              </button>
              
              {!isViewing && (
                <>
                  <button
                    type="button"
                    onClick={handleSaveDraft}
                    disabled={loading}
                    className="flex items-center px-6 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 disabled:opacity-50 text-sm font-semibold"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Save Draft
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={loading}
                    className="flex items-center px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-sm font-semibold"
                  >
                    <Send className="h-4 w-4 mr-2" />
                    Submit Request
                  </button>
                </>
              )}

              {/* HR/Admin Actions */}
              {id && (user?.role === "hr_manager" || user?.role === "admin") && (
                <>
                  <button
                    type="button"
                    onClick={handleReturn}
                    disabled={loading}
                    className="flex items-center px-6 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 disabled:opacity-50 text-sm font-semibold"
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Return
                  </button>
                  <button
                    type="button"
                    onClick={handleDecline}
                    disabled={loading}
                    className="flex items-center px-6 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 text-sm font-semibold"
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Decline
                  </button>
                  <button
                    type="button"
                    onClick={handleApprove}
                    disabled={loading}
                    className="flex items-center px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 text-sm font-semibold"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Approve
                  </button>
                </>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
