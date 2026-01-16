// Reusable validation regex patterns
export const VALIDATION_PATTERNS = {
  // Email validation
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,

  // Phone number (10 digits, optional formatting)
  PHONE: /^(\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}$/,

  // URL validation
  URL: /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/,

  // Alphanumeric only
  ALPHANUMERIC: /^[a-zA-Z0-9]+$/,

  // Alphanumeric with spaces
  ALPHANUMERIC_SPACE: /^[a-zA-Z0-9\s]+$/,

  // Username (letters, numbers, underscore, hyphen)
  USERNAME: /^[a-zA-Z0-9_-]{3,20}$/,

  // Strong password (min 8 chars, uppercase, lowercase, number, special char)
  PASSWORD_STRONG: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,

  // Numeric only
  NUMERIC: /^\d+$/,

  // Positive integer
  POSITIVE_INT: /^[1-9]\d*$/,

  // Date (MM/DD/YYYY)
  DATE_MMDDYYYY: /^(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])\/\d{4}$/,

  // ISO Date (YYYY-MM-DD)
  DATE_ISO: /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/,


  // Whitespace only
  WHITESPACE: /^\s+$/,
};

// Validation helper functions
export const validate = {
  email: (value) => VALIDATION_PATTERNS.EMAIL.test(value),
  phone: (value) => VALIDATION_PATTERNS.PHONE.test(value),
  url: (value) => VALIDATION_PATTERNS.URL.test(value),
  username: (value) => VALIDATION_PATTERNS.USERNAME.test(value),
  passwordStrong: (value) => VALIDATION_PATTERNS.PASSWORD_STRONG.test(value),
  numeric: (value) => VALIDATION_PATTERNS.NUMERIC.test(value),
  positiveInt: (value) => VALIDATION_PATTERNS.POSITIVE_INT.test(value),
  dateMMDDYYYY: (value) => VALIDATION_PATTERNS.DATE_MMDDYYYY.test(value),
  dateISO: (value) => VALIDATION_PATTERNS.DATE_ISO.test(value),
  creditCard: (value) => VALIDATION_PATTERNS.CREDIT_CARD.test(value),
  isWhitespace: (value) => VALIDATION_PATTERNS.WHITESPACE.test(value),
};

// Service Vehicle Request Form Validation
export const validateServiceVehicleForm = (formData) => {
  const errors = {};

  // Required fields validation
  if (!formData.requestor_name?.trim()) {
    errors.requestor_name = "Requestor name is required";
  }

  if (!formData.date_prepared?.trim()) {
    errors.date_prepared = "Date prepared is required";
  }

  if (!formData.department_id || (typeof formData.department_id === 'string' && !formData.department_id.trim())) {
    errors.department_id = "Department is required";
  }

  if (!formData.contact_number?.trim()) {
    errors.contact_number = "Contact number is required";
  } else if (!VALIDATION_PATTERNS.PHONE.test(formData.contact_number)) {
    errors.contact_number = "Invalid phone number format";
  }

  if (!formData.purpose?.trim()) {
    errors.purpose = "Purpose is required";
  }

  if (!formData.request_type) {
    errors.request_type = "Request type is required";
  }

  if (!formData.travel_date_from) {
    errors.travel_date_from = "Travel date from is required";
  }

  if (!formData.travel_date_to) {
    errors.travel_date_to = "Travel date to is required";
  }

  // Validate travel dates
  if (formData.travel_date_from && formData.travel_date_to) {
    if (new Date(formData.travel_date_from) > new Date(formData.travel_date_to)) {
      errors.travel_date_to = "Travel date to must be after travel date from";
    }
  }

  // Conditional validations based on request type
  const requestType = formData.request_type;

  if (["drop_passenger", "pickup_passenger", "pickup_item", "delivery_item"].includes(requestType)) {
    if (!formData.pick_up_location?.trim()) {
      errors.pick_up_location = "Pick-up location is required";
    }
    if (!formData.pick_up_time) {
      errors.pick_up_time = "Pick-up time is required";
    }
    if (!formData.drop_off_location?.trim()) {
      errors.drop_off_location = "Drop-off location is required";
    }
  }

  if (["drop_passenger", "pickup_item", "delivery_item"].includes(requestType)) {
    if (!formData.drop_off_time) {
      errors.drop_off_time = "Drop-off time is required";
    }
  }

  if (requestType === "point_to_point") {
    if (!formData.destination?.trim()) {
      errors.destination = "Destination is required";
    }
    if (!formData.departure_time) {
      errors.departure_time = "Departure time is required";
    }
  }

  if (requestType === "car_only") {
    if (!formData.destination_car?.trim()) {
      errors.destination_car = "Destination/Car use is required";
    }

    if (!formData.has_valid_license) {
      errors.has_valid_license = "Please confirm if you have a valid license";
    } else if (formData.has_valid_license === "false") {
      errors.has_valid_license = "A valid driver's license is required for Car Only requests";
    }
  }

  // Passengers validation
  if (["drop_passenger", "pickup_passenger"].includes(requestType)) {
    if (!formData.passengers || formData.passengers.length === 0) {
      errors.passengers = "At least one passenger is required";
    } else {
      const invalidPassengers = formData.passengers.filter(
        (p) => !p.name?.trim()
      );
      if (invalidPassengers.length > 0) {
        errors.passengers = "All passengers must have a name";
      }
    }
  }

  // License validation
  if (formData.has_valid_license === "true") {
    if (!formData.license_number?.trim()) {
      errors.license_number = "License number is required";
    }
    if (!formData.expiration_date) {
      errors.expiration_date = "License expiration date is required";
    } else {
      const expirationDate = new Date(formData.expiration_date);
      if (expirationDate < new Date()) {
        errors.expiration_date = "License has expired";
      }
    }
  }

  // Requested by date validation
  if (!formData.requested_by_date) {
    errors.requested_by_date = "Requested by date is required";
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};
