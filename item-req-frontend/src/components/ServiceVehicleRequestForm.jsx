import React, { useState, useEffect } from "react";
import {
  ArrowLeft,
  Plus,
  UserCheck,
  PenTool,
  Trash2,
  AlertCircle,
  Save,
  Send,
  RotateCcw,
  CheckCircle,
  XCircle,
  Loader,
  Paperclip,
  X,
  Download,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { validateServiceVehicleForm } from "../helpers/validations";
import STC_LOGO from "../assets/STC_LOGO.png";
import {
  serviceVehicleRequestsAPI,
  departmentsAPI,
  vehicleManagementApi,
  driverManagementApi,
} from "../services/api";
import SignatureModal from "./SignatureModal";
import VerifierAssignmentModal from "./VerifierAssignmentModal";
import VerificationResponseModal from "./VerificationResponseModal";

const REQUEST_TYPE_OPTIONS = [
  { value: "drop_passenger_only", label: "Drop Passenger Only" },
  {
    value: "point_to_point_service",
    label: "Point-to-Point Service (Waiting)",
  },
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
    requestor_signature: "",
    requested_by_date: new Date().toISOString().split('T')[0],
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
    urgency_justification: "",
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [isODHCUser, setIsODHCUser] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [pendingFiles, setPendingFiles] = useState([]); // Files selected before request is saved
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [availableVehicles, setAvailableVehicles] = useState([]);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [requestorDepartment, setRequestorDepartment] = useState("");
  const [availableDrivers, setAvailableDrivers] = useState([]);
  const [showJustificationModal, setShowJustificationModal] = useState(false);
  const [justificationReason, setJustificationReason] = useState("");
  const [showRequestorSignatureModal, setShowRequestorSignatureModal] = useState(false);
  const [tempRequestorSignature, setTempRequestorSignature] = useState("");
  const [showVerifierModal, setShowVerifierModal] = useState(false);
  const [showVerificationActionModal, setShowVerificationActionModal] = useState(false);
  const [verificationAction, setVerificationAction] = useState(null);

  useEffect(() => {
    // Get current user's full name from auth context
    const userFullName =
      user?.firstName + " " + user?.lastName || user?.name || "User";

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

    // Only set current user's department if creating a new request
    // If loading existing request, let loadFormData handle it
    if (!id) {
      setFormData((prev) => ({
        ...prev,
        requestor_name: userFullName,
        department_id: userDepartmentId || "",
        date_prepared: new Date().toISOString().split('T')[0],
        requested_by_date: new Date().toISOString().split('T')[0],
      }));
    } else {
      // For existing requests, only update requestor_name if not already set
      setFormData((prev) => ({
        ...prev,
        requestor_name: prev.requestor_name || userFullName,
        requested_by_signature: prev.requested_by_signature || userFullName,
      }));
    }

    // Check if user is from ODHC department
    if (userData) {
      try {
        const parsedUser = JSON.parse(userData);
        const departmentName = parsedUser.department?.name || "";
        const isODHC =
          departmentName.toLowerCase().includes("odhc") &&
          parsedUser.role === "department_approver";
        setIsODHCUser(isODHC);
      } catch (error) {
        console.error("Error parsing user data:", error);
      }
    }

    // Load existing request from database if editing
    if (id) {
      loadFormData(id);
    }

    // Fetch available vehicles and drivers
    loadAvailableVehicles();
    loadAvailableDrivers();
  }, [user, id]);

  const loadAvailableVehicles = async () => {
    try {
      const response = await vehicleManagementApi.getAll();
      setAvailableVehicles(response.data || []);
    } catch (error) {
      console.error("Error fetching available vehicles:", error);
      setAvailableVehicles([]);
    }
  };

  const loadAvailableDrivers = async () => {
    try {
      const response = await driverManagementApi.getAll();
      // Filter only active drivers
      const activeDrivers = (
        response.data?.drivers ||
        response.data ||
        []
      ).filter((driver) => driver.status === "active");
      setAvailableDrivers(activeDrivers);
    } catch (error) {
      console.error("Error fetching available drivers:", error);
      setAvailableDrivers([]);
    }
  };

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
        if (data.passengers && typeof data.passengers === "string") {
          data.passengers = [{ name: data.passengers }];
        } else {
          // Default to one empty passenger field
          data.passengers = [{ name: "" }];
        }
      } else {
        // Ensure all passenger objects have the name property
        data.passengers = data.passengers.map((p) =>
          typeof p === "string" ? { name: p } : p && p.name ? p : { name: "" }
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
          data.requested_by_date = dateValue.toISOString().split("T")[0];
        }
      }

      // Map approval_date to date format if needed
      if (data.approval_date) {
        const approvalDateValue = new Date(data.approval_date);
        if (!isNaN(approvalDateValue.getTime())) {
          data.approval_date = approvalDateValue.toISOString().split("T")[0];
        }
      }

      // Ensure all required fields have default values
      setFormData({
        ...formData,
        ...data,
        passengers: data.passengers || [{ name: "" }],
        requested_by_date:
          data.requested_by_date ||
          (data.requested_date
            ? new Date(data.requested_date).toISOString().split("T")[0]
            : ""),
        assigned_driver: data.assigned_driver || "",
        assigned_vehicle: data.assigned_vehicle || "",
        approval_date: data.approval_date || "",
      });

      // Store the requestor's department from loaded data
      if (data.Department) {
        setRequestorDepartment(data.Department.name);
      } else {
        setRequestorDepartment("");
      }

      // Load attachments
      if (data.attachments && Array.isArray(data.attachments)) {
        setAttachments(data.attachments);
      } else {
        setAttachments([]);
      }

      // If assigned_vehicle is set, find and set the vehicle details
      // Try to find from loaded availableVehicles, if not found, it will be displayed from formData
      if (data.assigned_vehicle) {
        // First check if availableVehicles is already loaded
        if (availableVehicles.length > 0) {
          const vehicle = availableVehicles.find(
            (v) => v.id === parseInt(data.assigned_vehicle)
          );
          if (vehicle) {
            setSelectedVehicle(vehicle);
          }
        } else {
          // If vehicles not yet loaded, we'll rely on the fallback logic in the render
          setSelectedVehicle(null);
        }
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

    // If assigning a vehicle, update the selectedVehicle state
    if (name === "assigned_vehicle" && value) {
      const vehicle = availableVehicles.find((v) => v.id === parseInt(value));
      setSelectedVehicle(vehicle || null);
    } else if (name === "assigned_vehicle") {
      setSelectedVehicle(null);
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
      passengers: [...currentPassengers, { name: "" }],
    });
  };

  const removePassenger = (index) => {
    const currentPassengers = formData.passengers || [{ name: "" }];
    const updatedPassengers = currentPassengers.filter((_, i) => i !== index);
    setFormData({ ...formData, passengers: updatedPassengers });
  };

  const handleJustificationSubmit = () => {
    if (!justificationReason.trim()) {
      alert("Please provide a justification for the same-day request.");
      return;
    }
    setFormData(prev => ({ ...prev, urgency_justification: justificationReason }));
    setShowJustificationModal(false);
    handleSubmit(justificationReason);
  };

  const handleSubmit = async (arg = null) => {
    const justificationOverride = typeof arg === 'string' ? arg : null;

    // Check for same-day request justification
    const isSameDay = formData.date_prepared === formData.travel_date_from;
    const hasJustification = justificationOverride || formData.urgency_justification;

    if (isSameDay && !hasJustification) {
      setShowJustificationModal(true);
      return;
    }

    // Validate dates before form validation
    const dateFields = [
      "date_prepared",
      "travel_date_from",
      "travel_date_to",
      "expiration_date",
    ];
    const cleanedFormData = { ...formData, status: "draft" }; // Save as draft first
    if (justificationOverride) {
      cleanedFormData.urgency_justification = justificationOverride;
    }

    dateFields.forEach((field) => {
      if (cleanedFormData[field] && cleanedFormData[field].trim() === "") {
        cleanedFormData[field] = null;
      }
    });

    // Validate with submitted status for validation rules
    const validationData = { ...cleanedFormData, status: "submitted" };
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
        requestId =
          response.data?.request?.id ||
          response.data?.request?.request_id ||
          response.data?.id;

        if (!requestId) {
          console.error("Response structure:", response.data);
          throw new Error("Could not determine request ID from response");
        }
      }

      // Upload pending files if any
      if (pendingFiles.length > 0 && requestId) {
        try {
          const uploadFormData = new FormData();
          pendingFiles.forEach((file) => {
            uploadFormData.append("files", file);
          });

          const uploadResponse = await serviceVehicleRequestsAPI.uploadAttachments(
            requestId,
            uploadFormData
          );

          if (uploadResponse.data.success) {
            setAttachments((prev) => [...prev, ...uploadResponse.data.attachments]);
            setPendingFiles([]); // Clear pending files after upload
          }
        } catch (uploadError) {
          console.error("Error uploading pending files:", uploadError);
          // Continue with submission even if file upload fails
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

      const dataToSave = { ...formData, status: "draft" };

      let requestId = id;

      if (id) {
        // Update existing draft
        await serviceVehicleRequestsAPI.update(id, dataToSave);
        requestId = id;
        setSuccessMessage("Draft updated successfully!");
      } else {
        // Create new draft
        const response = await serviceVehicleRequestsAPI.create(dataToSave);
        requestId =
          response.data?.request?.id ||
          response.data?.request?.request_id ||
          response.data?.id;
        setSuccessMessage("Form saved as draft successfully!");
      }

      // Upload pending files if any
      if (pendingFiles.length > 0 && requestId) {
        try {
          const uploadFormData = new FormData();
          pendingFiles.forEach((file) => {
            uploadFormData.append("files", file);
          });

          const uploadResponse = await serviceVehicleRequestsAPI.uploadAttachments(
            requestId,
            uploadFormData
          );

          if (uploadResponse.data.success) {
            setAttachments((prev) => [...prev, ...uploadResponse.data.attachments]);
            setPendingFiles([]); // Clear pending files after upload
          }
        } catch (uploadError) {
          console.error("Error uploading pending files:", uploadError);
          // Continue even if file upload fails
        }
      }

      // If this was a new request, navigate to the edit page
      if (!id && requestId) {
        setTimeout(() => {
          navigate(`/service-vehicle-requests/${requestId}`);
        }, 1500);
      } else {
        setTimeout(() => {
          navigate("/dashboard");
        }, 1500);
      }
    } catch (error) {
      console.error("Error saving draft:", error);
      setErrors({ submit: "Error saving draft. Please try again." });
    } finally {
      setLoading(false);
    }
  };

  const handleAssignVerifierClick = () => setShowVerifierModal(true);

  const handleAssignVerifier = async (verifierId) => {
    try {
      setLoading(true);
      await serviceVehicleRequestsAPI.assignVerifier(id, { verifier_id: verifierId });
      setSuccessMessage('Verifier assigned successfully');
      setShowVerifierModal(false);
      setTimeout(() => navigate('/dashboard'), 1500);
    } catch (err) {
      setErrors({ submit: err.message || "Failed to assign verifier" });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyClick = (action) => {
    setVerificationAction(action);
    setShowVerificationActionModal(true);
  };

  const handleVerificationConfirm = async (comments) => {
    try {
      setLoading(true);
      await serviceVehicleRequestsAPI.verifyRequest(id, {
        status: verificationAction === 'verify' ? 'verified' : 'declined',
        comments
      });
      setSuccessMessage(`Request ${verificationAction === 'verify' ? 'verified' : 'declined'}`);
      setShowVerificationActionModal(false);
      setTimeout(() => navigate('/dashboard'), 1500);
    } catch (err) {
      setErrors({ submit: err.message || "Failed to process verification" });
    } finally {
      setLoading(false);
    }
  };


  const handleFileUpload = async (event) => {
    const files = Array.from(event.target.files);
    if (!files.length) return;

    // If no id yet (new request), store files for later upload
    if (!id) {
      setPendingFiles((prev) => [...prev, ...files]);
      setSuccessMessage(`${files.length} file(s) selected. They will be uploaded when you save the request.`);
      setTimeout(() => setSuccessMessage(""), 3000);
      event.target.value = ""; // Reset file input
      return;
    }

    // Check permissions based on user role and request status
    const isApprover = user?.role === "department_approver" || user?.role === "super_administrator";
    const isRequestor = user?.role === "requestor";

    if (isRequestor) {
      // Requestors can upload attachments when status is draft or returned
      if (!["draft", "returned"].includes(formData.status)) {
        alert("You can only upload attachments when the request is in draft or returned status");
        event.target.value = ""; // Reset file input
        return;
      }
    } else if (isApprover) {
      // Approvers can upload attachments for submitted, returned, department_approved, or completed requests
      if (!["submitted", "returned", "department_approved", "completed"].includes(formData.status)) {
        alert("Attachments can only be uploaded for submitted, returned, department_approved, or completed requests");
        event.target.value = ""; // Reset file input
        return;
      }
    } else {
      alert("You do not have permission to upload attachments");
      event.target.value = ""; // Reset file input
      return;
    }

    try {
      setUploadingFiles(true);
      const formData = new FormData();
      files.forEach((file) => {
        formData.append("files", file);
      });

      const response = await serviceVehicleRequestsAPI.uploadAttachments(
        id,
        formData
      );

      if (response.data.success) {
        setAttachments((prev) => [...prev, ...response.data.attachments]);
        setSuccessMessage("Files uploaded successfully!");
        setTimeout(() => setSuccessMessage(""), 3000);
      }
    } catch (error) {
      console.error("Error uploading files:", error);
      alert(error.response?.data?.message || "Error uploading files");
    } finally {
      setUploadingFiles(false);
      event.target.value = ""; // Reset file input
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
      setAttachments((prev) => prev.filter((att) => att.filename !== filename));
      setSuccessMessage("Attachment deleted successfully!");
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (error) {
      console.error("Error deleting attachment:", error);
      alert(error.response?.data?.message || "Error deleting attachment");
    } finally {
      setLoading(false);
    }
  };

  const handleRemovePendingFile = (index) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
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
        assigned_vehicle: formData.assigned_vehicle
          ? parseInt(formData.assigned_vehicle)
          : null,
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
        alert(
          "Please fill in the Assigned Driver field in Section 4 before approving."
        );
        return;
      }

      if (!formData.assigned_vehicle) {
        alert(
          "Please fill in the Assigned Vehicle field in Section 4 before approving."
        );
        return;
      }

      if (!formData.approval_date) {
        alert(
          "Please fill in the Approval Date field in Section 4 before approving."
        );
        return;
      }

      // If Section 4 fields are not saved, save them first (only for ODHC users)
      if (id) {
        try {
          setLoading(true);
          await handleSaveSection4();
          // Wait a moment for the save to complete
          await new Promise((resolve) => setTimeout(resolve, 500));
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
      const approvalReason = prompt(
        "Please provide approval remarks (optional):"
      );

      // Ensure assigned_vehicle is sent as a number or null
      const approvalData = {
        remarks: approvalReason || "",
        assigned_vehicle: formData.assigned_vehicle
          ? parseInt(formData.assigned_vehicle)
          : null,
      };

      await serviceVehicleRequestsAPI.approve(id, approvalData);

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
    const reason = prompt(
      "Please provide a reason for returning this request:"
    );
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
    const reason = prompt(
      "Please provide a reason for declining this request:"
    );
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

  // Dynamic conditional section
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
      <div className="space-y-4">
        <div className="bg-gray-50 p-3 border border-gray-300">
          <h3 className="text-xs font-bold text-gray-900 mb-3">
            {config.title}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
            {config.fields.map((field) => (
              <div
                key={field.name}
                className={field.span === 2 ? "col-span-1 md:col-span-2" : ""}
              >
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  {field.label} <span className="text-red-600">*</span>
                </label>
                <div
                  className={`border-b-2 pb-1 ${errors[field.name] ? "border-red-500" : "border-gray-400"
                    }`}
                >
                  <input
                    type={field.type}
                    name={field.name}
                    value={formData[field.name] || ""}
                    {...getInputProps({
                      onChange: handleChange,
                      className:
                        "w-full bg-transparent border-0 focus:outline-none text-sm",
                      disabled: loading,
                    })}
                  />
                </div>
                {errors[field.name] && (
                  <p className="text-red-500 text-xs mt-1">
                    {errors[field.name]}
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* Passengers Section */}
          {config.showPassengers && (
            <div className="border-t border-gray-300 pt-4 mt-4">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-xs font-bold text-gray-900">
                  {config.passengerLabel || "Passengers"}
                </h3>
                {!isViewing && (
                  <button
                    type="button"
                    onClick={addPassenger}
                    disabled={loading}
                    className="flex items-center gap-1 text-blue-600 hover:text-blue-800 text-sm"
                  >
                    <Plus className="h-4 w-4" />
                    Add Passenger
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {(formData.passengers || []).map((passenger, index) => (
                  <div
                    key={index}
                    className="bg-gray-50 p-3 border border-gray-300"
                  >
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-semibold text-gray-700">
                        Passenger {index + 1}
                      </span>
                      {!isViewing && (formData.passengers || []).length > 1 && (
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

                    <div className="grid grid-cols-1 gap-2">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          Name <span className="text-red-600">*</span>
                        </label>
                        <div className="border-b-2 border-gray-400 pb-1">
                          <input
                            type="text"
                            value={passenger.name}
                            {...getInputProps({
                              onChange: (e) =>
                                handlePassengerChange(
                                  index,
                                  "name",
                                  e.target.value
                                ),
                              className:
                                "w-full bg-transparent border-0 focus:outline-none text-sm",
                              disabled: loading,
                            })}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {errors.passengers && (
                <p className="text-red-500 text-xs mt-1">{errors.passengers}</p>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  const currentPath = window.location.pathname;
  const isEditing = currentPath.includes("/edit");
  const isViewing = !!id && !isEditing;
  const isCreating = !id;

  // Check if request is submitted/completed (should be read-only)
  // Returned requests can be edited by the requestor even when viewing
  const isReturnedAndCanEdit =
    isViewing &&
    formData.status === "returned" &&
    user?.id === formData.requested_by;
  const isReadOnly =
    isViewing &&
    formData.status &&
    !["draft", "returned"].includes(formData.status) &&
    !isReturnedAndCanEdit;

  const getInputProps = (baseProps = {}) => {
    // Allow editing if: creating, editing, or viewing returned request as requestor
    const canEdit = isCreating || isEditing || isReturnedAndCanEdit;

    if (!canEdit && (isViewing || isReadOnly)) {
      return {
        ...baseProps,
        disabled: true,
        readOnly: true,
        className: `${baseProps.className || ""
          } bg-gray-50 cursor-not-allowed`.trim(),
      };
    }
    return baseProps;
  };

  const renderFieldError = (fieldName) => {
    if (errors[fieldName]) {
      return <p className="text-red-500 text-xs mt-1">{errors[fieldName]}</p>;
    }
    return null;
  };

  const getRecommendedVehicles = () => {
    // Count passengers for passenger-related requests
    const passengerCount = (formData.passengers || []).filter(
      (p) => p.name && p.name.trim()
    ).length;

    if (passengerCount === 0) {
      return availableVehicles; // Return all vehicles if no passengers
    }

    // Recommend vehicles with seaters >= passenger count + 1 (for driver)
    return availableVehicles.filter(
      (vehicle) => vehicle.seaters >= passengerCount + 1
    );
  };

  const isVehicleRecommended = (vehicleId) => {
    const passengerCount = (formData.passengers || []).filter(
      (p) => p.name && p.name.trim()
    ).length;

    if (passengerCount === 0) {
      return false;
    }

    return getRecommendedVehicles().some((v) => v.id === vehicleId);
  };

  const getAvailableVehiclesMessage = () => {
    const passengerCount = (formData.passengers || []).filter(
      (p) => p.name && p.name.trim()
    ).length;

    if (passengerCount === 0) {
      return null;
    }

    const recommendedVehicles = getRecommendedVehicles();
    const requiredSeaters = passengerCount + 1;

    if (recommendedVehicles.length === 0) {
      return (
        <p className="text-xs text-red-600 mt-2">
          No vehicle available with {requiredSeaters}+ seaters for{" "}
          {passengerCount} passenger{passengerCount > 1 ? "s" : ""} + driver
        </p>
      );
    }

    return null;
  };

  if (loading && !id) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      {/* Back Button */}
      <div className="max-w-4xl mx-auto mb-4 px-4">
        <button
          onClick={() => navigate("/dashboard")}
          className="flex items-center text-gray-600 hover:text-gray-800"
        >
          <ArrowLeft className="h-5 w-5 mr-1" />
          Back to Dashboard
        </button>
      </div>

      {/* PDF-like Form Container */}
      <div
        className="max-w-4xl mx-auto bg-white shadow-2xl"
        style={{ boxShadow: "0 0 30px rgba(0,0,0,0.15)" }}
      >
        <div className="p-8 md:p-12" style={{ minHeight: "11in" }}>
          {/* Header Section */}
          <div className="border-b-2 border-gray-800 pb-4 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <img src={STC_LOGO} alt="STC Logo" className="h-16 w-auto" />
                <div>
                  <div className="text-xl font-bold text-gray-900">
                    STYROTECH CORPORATION
                  </div>
                  <div className="text-sm text-gray-600">
                    Packaging Solutions
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-gray-500">Form No.</div>
                <div className="text-sm font-semibold text-gray-700">
                  HRD-FM-035 rev.04
                </div>
              </div>
            </div>
            <div className="text-center">
              <h1 className="text-2xl font-bold text-gray-900 uppercase tracking-wide">
                Service Vehicle Request Form
              </h1>
              {(isViewing || isEditing) && id && (
                <div className="text-sm text-gray-600 mt-2">
                  Reference Code:{" "}
                  <span className="font-semibold">
                    {formData.reference_code || `SVR-${id}`}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Success Message */}
          {successMessage && (
            <div className="mb-6 p-4 bg-green-50 border-2 border-green-400">
              <p className="text-green-700 text-sm font-semibold">
                {successMessage}
              </p>
            </div>
          )}

          {/* Pending Verification Banner */}
          {formData.verification_status === 'pending' && (
            <div className="mb-6 p-4 bg-purple-50 border-2 border-purple-500 rounded-md">
              <div className="flex items-center">
                <div className="p-2">
                  <UserCheck className="h-6 w-6 text-purple-500" />
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-purple-800">Pending Verification</h3>
                  {formData.Verifier && (
                    <div className="text-sm text-purple-700">
                      Assigned to: {formData.Verifier.first_name} {formData.Verifier.last_name}
                    </div>
                  )}
                  <div className="text-sm text-purple-700 italic mt-1">
                    This request is waiting for verification review.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Verification Status Banner */}
          {formData.verification_status === 'verified' && (
            <div className="mb-6 p-4 bg-green-50 border-2 border-green-500 rounded-md">
              <div className="flex items-center">
                <div className="p-2">
                  <CheckCircle className="h-6 w-6 text-green-500" />
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-green-800">Verified</h3>
                  {formData.Verifier && (
                    <div className="text-sm text-green-700">
                      Verified by: {formData.Verifier.first_name} {formData.Verifier.last_name}
                    </div>
                  )}
                  {formData.verified_at && (
                    <div className="text-sm text-green-700">
                      Date: {new Date(formData.verified_at).toLocaleString()}
                    </div>
                  )}
                  {formData.verifier_comments && (
                    <div className="mt-1 text-sm text-green-700 italic border-l-2 border-green-300 pl-2">
                      "{formData.verifier_comments}"
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {formData.verification_status === 'declined' && (
            <div className="mb-6 p-4 bg-red-50 border-2 border-red-500 rounded-md">
              <div className="flex items-center">
                <div className="p-2">
                  <XCircle className="h-6 w-6 text-red-500" />
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">Verification Declined</h3>
                  {formData.Verifier && (
                    <div className="text-sm text-red-700">
                      Declined by: {formData.Verifier.first_name} {formData.Verifier.last_name}
                    </div>
                  )}
                  {formData.verifier_comments && (
                    <div className="mt-1 text-sm text-red-700 italic border-l-2 border-red-300 pl-2">
                      Reason: "{formData.verifier_comments}"
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Error Display */}
          {errors.submit && (
            <div className="bg-red-50 border-2 border-red-400 p-4 mb-4">
              <p className="text-red-600 text-sm">{errors.submit}</p>
            </div>
          )}

          {/* Form */}
          <form className="space-y-6">
            {/* Section 1: Requestor Information */}
            <div className="border border-gray-400 p-4 mb-6">
              <div className="bg-gray-100 -m-4 mb-4 px-4 py-2 border-b border-gray-400">
                <h2 className="text-sm font-bold text-gray-900 uppercase">
                  Section 1: Requestor Information
                </h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Name of Requestor <span className="text-red-600">*</span>
                  </label>
                  <div className="border-b-2 border-gray-400 pb-1">
                    <input
                      type="text"
                      value={formData.requestor_name}
                      disabled
                      className="w-full bg-transparent border-0 focus:outline-none text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Date Prepared <span className="text-red-600">*</span>
                  </label>
                  <div
                    className={`border-b-2 pb-1 ${errors.date_prepared
                      ? "border-red-500"
                      : "border-gray-400"
                      }`}
                  >
                    <input
                      type="date"
                      name="date_prepared"
                      value={formData.date_prepared}
                      {...getInputProps({
                        onChange: handleChange,
                        className:
                          "w-full bg-transparent border-0 focus:outline-none text-sm",
                        disabled: loading,
                      })}
                    />
                  </div>
                  {errors.date_prepared && (
                    <p className="text-red-500 text-xs mt-1">
                      {errors.date_prepared}
                    </p>
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
                        requestorDepartment ||
                        (() => {
                          const userData = localStorage.getItem("user");
                          if (userData && !id) {
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
                      disabled
                      className="w-full bg-transparent border-0 focus:outline-none text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Contact Number <span className="text-red-600">*</span>
                  </label>
                  <div
                    className={`border-b-2 pb-1 ${errors.contact_number
                      ? "border-red-500"
                      : "border-gray-400"
                      }`}
                  >
                    <input
                      type="tel"
                      name="contact_number"
                      value={formData.contact_number}
                      placeholder="e.g., 09171234567"
                      {...getInputProps({
                        onChange: (e) => {
                          const value = e.target.value.replace(/[^0-9]/g, "");
                          handleChange({
                            target: { name: "contact_number", value },
                          });
                        },
                        className:
                          "w-full bg-transparent border-0 focus:outline-none text-sm",
                        disabled: loading,
                      })}
                    />
                  </div>
                  {errors.contact_number && (
                    <p className="text-red-500 text-xs mt-1">
                      {errors.contact_number}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Section 2: Request Details */}
            <div className="border border-gray-400 p-4 mb-6">
              <div className="bg-gray-100 -m-4 mb-4 px-4 py-2 border-b border-gray-400">
                <h2 className="text-sm font-bold text-gray-900 uppercase">
                  Section 2: Request Specific Details
                </h2>
              </div>

              {/* Urgency Justification Display */}
              {formData.urgency_justification && (
                <div className="mb-3 md:mb-4 flex flex-col">
                  <label className="text-xs font-semibold block mb-1 text-red-600">
                    Justification for Same-Day Request
                  </label>
                  <textarea
                    value={formData.urgency_justification}
                    readOnly
                    className="w-full border border-red-300 bg-red-50 px-2 py-1 text-xs focus:outline-none"
                    rows="2"
                  ></textarea>
                </div>
              )}

              {/* Purpose */}
              <div className="mb-3 md:mb-4 flex flex-col">
                <label className="text-xs font-semibold block mb-1">
                  Purpose of Request <span className="text-red-600">*</span>
                </label>
                <textarea
                  name="purpose"
                  value={formData.purpose}
                  {...getInputProps({
                    onChange: handleChange,
                    className:
                      "w-full border border-black px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500",
                    disabled: loading || isReadOnly,
                    rows: "2",
                  })}
                ></textarea>
                {renderFieldError("purpose")}
              </div>

              {/* Request Type */}
              <div className="mb-3 md:mb-4 flex flex-col">
                <label className="text-xs font-semibold block mb-1">
                  Type of Request <span className="text-red-600">*</span>
                </label>
                <select
                  name="request_type"
                  value={formData.request_type}
                  {...getInputProps({
                    onChange: handleChange,
                    className:
                      "w-full border border-black px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500",
                    disabled: loading || isReadOnly,
                  })}
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
                    Travel Date From <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="date"
                    name="travel_date_from"
                    value={formData.travel_date_from}
                    {...getInputProps({
                      onChange: handleChange,
                      className:
                        "border-b border-black px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500",
                      disabled: loading || isReadOnly,
                    })}
                  />
                  {renderFieldError("travel_date_from")}
                </div>
                <div className="flex flex-col">
                  <label className="text-xs font-semibold mb-1">
                    Travel Date To <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="date"
                    name="travel_date_to"
                    value={formData.travel_date_to}
                    {...getInputProps({
                      onChange: handleChange,
                      className:
                        "border-b border-black px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500",
                      disabled: loading || isReadOnly,
                    })}
                  />
                  {renderFieldError("travel_date_to")}
                </div>
              </div>

              {/* Dynamic Conditional Section */}
              {formData.request_type && renderConditionalSection()}
            </div>

            {/* Section 3: Driver's License Information - Only for car_only request type */}
            {formData.request_type === "car_only" && (
              <div className="border border-gray-400 p-4 mb-6">
                <div className="bg-gray-100 -m-4 mb-4 px-4 py-2 border-b border-gray-400">
                  <h2 className="text-sm font-bold text-gray-900 uppercase">
                    Section 3: Driver's License Information
                  </h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Do you have a valid Driver's License? <span className="text-red-600">*</span>
                    </label>
                    <div className="border-b-2 border-gray-400 pb-1">
                      <select
                        name="has_valid_license"
                        value={formData.has_valid_license}
                        {...getInputProps({
                          onChange: handleChange,
                          className:
                            "w-full bg-transparent border-0 focus:outline-none text-sm",
                          disabled: loading,
                        })}
                      >
                        <option value="" disabled>
                          Select
                        </option>
                        <option value="true">Yes</option>
                        <option value="false">No</option>
                      </select>
                    </div>
                    {errors.has_valid_license && (
                      <p className="text-red-500 text-xs mt-1">
                        {errors.has_valid_license}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      License Number <span className="text-red-600">*</span>
                    </label>
                    <div
                      className={`border-b-2 pb-1 ${errors.license_number
                        ? "border-red-500"
                        : "border-gray-400"
                        }`}
                    >
                      <input
                        type="text"
                        name="license_number"
                        value={formData.license_number || ""}
                        {...getInputProps({
                          onChange: handleChange,
                          className:
                            "w-full bg-transparent border-0 focus:outline-none text-sm",
                          disabled:
                            loading ||
                            formData.has_valid_license === "false" ||
                            formData.has_valid_license === "",
                        })}
                      />
                    </div>
                    {errors.license_number && (
                      <p className="text-red-500 text-xs mt-1">
                        {errors.license_number}
                      </p>
                    )}
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      License Expiration Date <span className="text-red-600">*</span>
                    </label>
                    <div
                      className={`border-b-2 pb-1 ${errors.expiration_date
                        ? "border-red-500"
                        : "border-gray-400"
                        }`}
                    >
                      <input
                        type="date"
                        name="expiration_date"
                        value={formData.expiration_date || ""}
                        {...getInputProps({
                          onChange: handleChange,
                          className:
                            "w-full bg-transparent border-0 focus:outline-none text-sm",
                          disabled:
                            loading ||
                            formData.has_valid_license === "false" ||
                            formData.has_valid_license === "",
                        })}
                      />
                    </div>
                    {errors.expiration_date && (
                      <p className="text-red-500 text-xs mt-1">
                        {errors.expiration_date}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Section 3: Requestor Signature */}
            <div className="border border-gray-400 p-4 mb-6">
              <div className="bg-gray-100 -m-4 mb-4 px-4 py-2 border-b border-gray-400">
                <h2 className="text-sm font-bold text-gray-900 uppercase">
                  Section 3: Requestor Signature
                </h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Name and Signature
                  </label>
                  <div className="border-b-2 border-gray-400 pb-1 min-h-[40px] flex items-end">
                    {formData.requestor_signature ? (
                      <div className="w-full">
                        <div
                          className={`mb-0 ${!isReadOnly && (user?.id === formData.requested_by || !id) ? "cursor-pointer group relative" : ""}`}
                          onClick={() => {
                            if (!isReadOnly && (user?.id === formData.requested_by || !id)) {
                              setTempRequestorSignature(formData.requestor_signature);
                              setShowRequestorSignatureModal(true);
                            }
                          }}
                        >
                          <img
                            src={formData.requestor_signature}
                            alt="Signature"
                            className="h-10 object-contain -mb-4 relative z-10"
                          />
                          {!isReadOnly && (user?.id === formData.requested_by || !id) && (
                            <span className="block text-[10px] text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">Click to edit</span>
                          )}
                        </div>
                        <p className="text-sm text-gray-900 -mt-2 leading-tight relative z-0">{formData.requestor_name}</p>
                      </div>
                    ) : (
                      <div
                        className={`w-full flex items-center justify-between ${!isReadOnly && (user?.id === formData.requested_by || !id) ? "cursor-pointer hover:bg-gray-50 p-1 rounded" : ""}`}
                        onClick={() => {
                          if (!isReadOnly && (user?.id === formData.requested_by || !id)) {
                            setTempRequestorSignature("");
                            setShowRequestorSignatureModal(true);
                          }
                        }}
                      >
                        <span className="text-sm text-gray-900">{formData.requestor_name || "Select to Sign"}</span>
                        {!isReadOnly && (user?.id === formData.requested_by || !id) && (
                          <PenTool className="h-4 w-4 text-gray-400" />
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Date
                  </label>
                  <div className="border-b-2 border-gray-400 pb-1">
                    <input
                      type="date"
                      name="requested_by_date"
                      value={formData.requested_by_date || ""}
                      readOnly
                      className="w-full bg-transparent border-0 focus:outline-none text-sm text-center"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Section 4: General Services Section */}
            <div className="border border-gray-400 p-4 mb-6">
              <div className="bg-gray-100 -m-4 mb-4 px-4 py-2 border-b border-gray-400">
                <h2 className="text-sm font-bold text-gray-900 uppercase">
                  Section 4: To Be Accomplished by OD & Human Capital – General
                  Services
                </h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Reference Code
                  </label>
                  <div className="border-b-2 border-gray-400 pb-1">
                    <div className="text-sm text-gray-500">
                      {formData.reference_code || "-"}
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Assigned Driver
                  </label>
                  {isODHCUser && (isViewing || isEditing) ? (
                    <div className="border-b-2 border-gray-400 pb-1">
                      <select
                        name="assigned_driver"
                        value={formData.assigned_driver || ""}
                        onChange={handleChange}
                        disabled={
                          loading || getRecommendedVehicles().length === 0
                        }
                        className="w-full bg-transparent border-0 focus:outline-none text-sm text-center"
                      >
                        <option value="">Select a driver</option>
                        {availableDrivers.map((driver) => (
                          <option key={driver.id} value={driver.name}>
                            {driver.name} - {driver.license_number}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className="border-b-2 border-gray-400 pb-1">
                      <div className="text-sm text-gray-500">
                        {formData.assigned_driver || "-"}
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Approval Date
                  </label>
                  {isODHCUser && (isViewing || isEditing) ? (
                    <input
                      type="date"
                      name="approval_date"
                      value={formData.approval_date || ""}
                      onChange={handleChange}
                      disabled={loading}
                      className="w-full bg-transparent border-b-2 border-gray-400 pb-1 focus:outline-none text-sm text-center"
                    />
                  ) : (
                    <div className="border-b-2 border-gray-400 pb-1">
                      <div className="text-sm text-gray-500">
                        {formData.approval_date
                          ? new Date(
                            formData.approval_date
                          ).toLocaleDateString()
                          : "-"}
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Assigned Vehicle
                  </label>
                  {isODHCUser && (isViewing || isEditing) ? (
                    <div>
                      <div className="border-b-2 border-gray-400 pb-1">
                        <select
                          name="assigned_vehicle"
                          value={formData.assigned_vehicle || ""}
                          onChange={handleChange}
                          disabled={
                            loading || getRecommendedVehicles().length === 0
                          }
                          className="w-full bg-transparent border-0 focus:outline-none text-sm text-center"
                        >
                          <option value="">Select a vehicle</option>
                          {getRecommendedVehicles().map((vehicle) => {
                            const isRecommended = isVehicleRecommended(
                              vehicle.id
                            );
                            return (
                              <option key={vehicle.id} value={vehicle.id}>
                                {vehicle.plate} - {vehicle.year} {vehicle.make}{" "}
                                {vehicle.model} ({vehicle.seaters} seaters)
                                {isRecommended ? " - Recommended ✓" : ""}
                              </option>
                            );
                          })}
                        </select>
                      </div>
                      {getAvailableVehiclesMessage()}
                    </div>
                  ) : (
                    <div className="border-b-2 border-gray-400 pb-1">
                      <div className="text-sm text-gray-500">
                        {selectedVehicle
                          ? `${selectedVehicle.plate} - ${selectedVehicle.year} ${selectedVehicle.make} ${selectedVehicle.model} (${selectedVehicle.seaters} seaters)`
                          : formData.assigned_vehicle
                            ? (() => {
                              const vehicle = availableVehicles.find(
                                (v) =>
                                  v.id === parseInt(formData.assigned_vehicle)
                              );
                              return vehicle
                                ? `${vehicle.plate} - ${vehicle.year} ${vehicle.make} ${vehicle.model} (${vehicle.seaters} seaters)`
                                : "-";
                            })()
                            : "-"}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              {isODHCUser && (isViewing || isEditing) && (
                <div className="mt-4">
                  {!(
                    formData.assigned_driver &&
                    formData.assigned_driver.trim() &&
                    formData.assigned_vehicle &&
                    formData.approval_date
                  ) &&
                    formData.status === "submitted" && (
                      <div className="mb-3 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
                        <strong> Action Required:</strong> Please complete
                        Section 4 (Assigned Driver, Assigned Vehicle, and
                        Approval Date) before approving this request.
                      </div>
                    )}
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleSaveSection4}
                      disabled={loading}
                      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-semibold disabled:opacity-50"
                    >
                      {loading ? "Saving..." : "Save Section 4"}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Attachments Section */}
            <div className="border border-gray-400 p-4 mb-6">
              <div className="bg-gray-100 -m-4 mb-4 px-4 py-2 border-b border-gray-400">
                <h2 className="text-sm font-bold text-gray-900 uppercase">
                  Attachments
                </h2>
              </div>

              {/* Show upload UI for:
                  - Requestors: always (even when creating new request)
                  - Approvers: when reviewing (submitted, returned, department_approved, or completed status)
              */}
              {(
                // Requestors can always select files
                user?.role === "requestor" ||
                // Approvers can upload when status is submitted, returned, department_approved, or completed
                (id && (user?.role === "department_approver" || user?.role === "super_administrator") &&
                  ["submitted", "returned", "department_approved", "completed"].includes(formData.status))
              ) && (
                  <div className="mb-4">
                    <label className="block text-xs font-semibold text-gray-700 mb-2">
                      Upload Files
                    </label>
                    <div className="flex items-center space-x-2">
                      <label className="flex items-center px-4 py-2 bg-gray-100 border border-gray-300 rounded cursor-pointer hover:bg-gray-200 text-sm">
                        <Paperclip className="h-4 w-4 mr-2" />
                        {uploadingFiles ? "Uploading..." : "Choose Files"}
                        <input
                          type="file"
                          multiple
                          onChange={handleFileUpload}
                          disabled={uploadingFiles || loading}
                          className="hidden"
                          accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.jpg,.jpeg,.png,.gif,.zip,.rar"
                        />
                      </label>
                      <span className="text-xs text-gray-500">
                        Max 10MB per file
                      </span>
                    </div>
                    {!id && pendingFiles.length > 0 && (
                      <p className="text-xs text-blue-600 mt-2">
                        {pendingFiles.length} file(s) will be uploaded when you save this request.
                      </p>
                    )}
                  </div>
                )}

              {/* Show pending files (files selected but not yet uploaded) */}
              {pendingFiles.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-xs font-semibold text-gray-700 mb-2">
                    Pending Files (will be uploaded when saved)
                  </h3>
                  <div className="space-y-2">
                    {pendingFiles.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 bg-yellow-50 border border-yellow-200 rounded"
                      >
                        <div className="flex items-center space-x-3 flex-1">
                          <Paperclip className="h-4 w-4 text-yellow-600" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-900 truncate">
                              {file.name}
                            </p>
                            <span className="text-xs text-gray-500">
                              {formatFileSize(file.size || 0)}
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemovePendingFile(index)}
                          disabled={loading}
                          className="p-1 text-red-600 hover:text-red-800 disabled:opacity-50"
                          title="Remove file"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Show uploaded attachments */}
              {attachments.length > 0 ? (
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold text-gray-700 mb-2">
                    Uploaded Files
                  </h3>
                  {attachments.map((attachment, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded"
                    >
                      <div className="flex items-center space-x-3 flex-1">
                        <Paperclip className="h-4 w-4 text-gray-500" />
                        <div className="flex-1 min-w-0">
                          <a
                            href={`${window.location.protocol}//${window.location.hostname}:3001${attachment.path}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-blue-600 hover:underline truncate block"
                          >
                            {attachment.originalName || attachment.filename}
                          </a>
                          <span className="text-xs text-gray-500">
                            {formatFileSize(attachment.size || 0)}
                          </span>
                        </div>
                      </div>
                      {/* Show delete button for:
                          - Requestors: on their own draft or returned requests
                          - Approvers: on any request they can access
                      */}
                      {id &&
                        (
                          (user?.role === "requestor" && ["draft", "returned"].includes(formData.status)) ||
                          user?.role === "department_approver" ||
                          user?.role === "super_administrator"
                        ) && (
                          <button
                            type="button"
                            onClick={() =>
                              handleDeleteAttachment(attachment.filename)
                            }
                            disabled={loading}
                            className="p-1 text-red-600 hover:text-red-800 disabled:opacity-50"
                            title="Delete attachment"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                    </div>
                  ))}
                </div>
              ) : (
                !pendingFiles.length && (
                  <p className="text-sm text-gray-500 italic">No attachments</p>
                )
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end space-x-4 pt-6 border-t-2 border-gray-400 mt-8">
              <button
                type="button"
                onClick={handleCancel}
                disabled={loading}
                className="px-6 py-2 border-2 border-gray-400 rounded text-gray-700 hover:bg-gray-50 text-sm font-semibold disabled:opacity-50"
              >
                {isViewing ? "Back" : "Cancel"}
              </button>

              {/* Show edit/submit buttons for requestor when: creating, editing, or viewing returned requests */}
              {user?.role === "requestor" &&
                (isCreating || isEditing || isReturnedAndCanEdit) && (
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
                      {loading ? (
                        <Loader className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4 mr-2" />
                      )}
                      {formData.status === "returned"
                        ? "Resubmit Request"
                        : "Submit Request"}
                    </button>
                  </>
                )}

              {/* Verifier Actions */}
              {isViewing && formData.verifier_id === user?.id && formData.verification_status === 'pending' && (
                <>
                  <button
                    type="button"
                    onClick={() => handleVerifyClick('decline')}
                    className="flex items-center px-6 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm font-semibold"
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Decline Verification
                  </button>
                  <button
                    type="button"
                    onClick={() => handleVerifyClick('verify')}
                    className="flex items-center px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm font-semibold"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Verify Request
                  </button>
                </>
              )}

              {/* Assign Verifier (ODHC) */}
              {isViewing && isODHCUser && (formData.status === 'submitted' || formData.status === 'department_approved') && !['verified', 'declined'].includes(formData.verification_status) && (
                <button
                  type="button"
                  onClick={handleAssignVerifierClick}
                  className="flex items-center px-6 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 text-sm font-semibold"
                >
                  <UserCheck className="h-4 w-4 mr-2" />
                  Assign Verifier
                </button>
              )}

              {/* ODHC (Department Approver) Actions - Only for vehicle requests */}
              {(() => {
                // Allow approval/return/decline for: submitted, returned, and department_approved (for Step 2 approvers)
                // Also allow for any workflow intermediate statuses
                const canApprove =
                  isViewing &&
                  (user?.role === "department_approver" ||
                    user?.role === "super_administrator") &&
                  (formData.status === "submitted" ||
                    formData.status === "returned" ||
                    ((isODHCUser || user?.role === "super_administrator") && formData.status === "department_approved") ||
                    (formData.status &&
                      formData.status !== "completed" &&
                      formData.status !== "declined" &&
                      formData.status !== "draft" &&
                      formData.status !== "department_approved"));
                if (
                  isViewing &&
                  (user?.role === "department_approver" ||
                    user?.role === "super_administrator")
                ) {
                  console.log(
                    "Approval button check - isViewing:",
                    isViewing,
                    "role:",
                    user?.role,
                    "status:",
                    formData.status,
                    "canApprove:",
                    canApprove
                  );
                }
                return canApprove;
              })() && (
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
                      disabled={
                        loading ||
                        (isODHCUser &&
                          !(
                            formData.assigned_driver &&
                            formData.assigned_driver.trim() &&
                            formData.assigned_vehicle &&
                            formData.approval_date
                          ))
                      }
                      className="flex items-center px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold"
                      title={
                        isODHCUser &&
                          !(
                            formData.assigned_driver &&
                            formData.assigned_driver.trim() &&
                            formData.assigned_vehicle &&
                            formData.approval_date
                          )
                          ? "Please complete Section 4 (Assigned Driver, Assigned Vehicle, and Approval Date) before approving"
                          : ""
                      }
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Approve & Complete
                    </button>
                  </>
                )}
            </div>
          </form>
        </div>
      </div>
      <SignatureModal
        isOpen={showRequestorSignatureModal}
        onClose={() => {
          setShowRequestorSignatureModal(false);
          setTempRequestorSignature('');
        }}
        value={tempRequestorSignature}
        onChange={(signature) => setTempRequestorSignature(signature)}
        approverName={formData.requestor_name}
        approverTitle="Requestor"
        label="Requestor E-Signature"
        onSave={() => {
          setFormData(prev => ({ ...prev, requestor_signature: tempRequestorSignature }));
          setShowRequestorSignatureModal(false);
        }}
      />

      <VerifierAssignmentModal
        isOpen={showVerifierModal}
        onClose={() => setShowVerifierModal(false)}
        onAssign={handleAssignVerifier}
        loading={loading}
      />

      <VerificationResponseModal
        isOpen={showVerificationActionModal}
        onClose={() => setShowVerificationActionModal(false)}
        onConfirm={handleVerificationConfirm}
        action={verificationAction}
        loading={loading}
      />
      {/* Justification Modal */}
      {showJustificationModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-lg w-full">
            <h3 className="text-lg font-bold text-red-600 mb-4 flex items-center">
              <AlertCircle className="h-6 w-6 mr-2" />
              Justification Required
            </h3>
            <p className="text-sm text-gray-700 mb-4">
              As a general rule, same-day requests are not allowed.
              <br />
              Exceptions may be granted only in cases of emergency or business exigency, subject to approval.
              <br /><br />
              Please submit a justification.
            </p>
            <textarea
              value={justificationReason}
              onChange={(e) => setJustificationReason(e.target.value)}
              className="w-full border border-gray-300 rounded p-2 mb-4 focus:outline-none focus:ring-2 focus:ring-red-500"
              placeholder="Enter your justification here..."
              rows={4}
            />
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowJustificationModal(false)}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleJustificationSubmit}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm font-semibold"
              >
                Submit Request
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
