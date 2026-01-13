import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Car, ArrowLeft } from 'lucide-react';

const FormSelector = () => {
  const navigate = useNavigate();

  const formOptions = [
    {
      id: 'item',
      title: 'Item Request Form',
      description: 'Request IT equipment and accessories',
      icon: FileText,
      color: 'blue',
      route: '/requests/new'
    },
    {
      id: 'vehicle',
      title: 'Vehicle Request Form',
      description: 'Request service vehicle for transportation',
      icon: Car,
      color: 'green',
      route: '/service-vehicle-requests/new'
    }
  ];

  const handleFormSelect = (form) => {
    navigate(form.route);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center text-gray-600 hover:text-gray-800 mb-4"
          >
            <ArrowLeft className="h-5 w-5 mr-1" />
            Back to Dashboard
          </button>
          
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="w-16 h-16 bg-blue-600 flex items-center justify-center text-white font-bold text-xl rounded-lg">
                  STC
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">STYROTECH CORPORATION</h1>
                  <p className="text-sm text-gray-600">Request Forms</p>
                </div>
              </div>
            </div>
            
            <div className="border-t border-gray-200 pt-6">
              <h2 className="text-lg font-semibold text-gray-700 mb-2">Select a Form Type</h2>
              <p className="text-sm text-gray-500">
                Choose the type of request you would like to create
              </p>
            </div>
          </div>
        </div>

        {/* Form Selection Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {formOptions.map((form) => {
            const Icon = form.icon;
            const colorClasses = {
              blue: 'bg-blue-50 border-blue-200 hover:bg-blue-100 hover:border-blue-300',
              green: 'bg-green-50 border-green-200 hover:bg-green-100 hover:border-green-300'
            };
            const iconColorClasses = {
              blue: 'bg-blue-600 text-white',
              green: 'bg-green-600 text-white'
            };

            return (
              <div
                key={form.id}
                onClick={() => handleFormSelect(form)}
                className={`bg-white rounded-lg shadow-md border-2 cursor-pointer transition-all duration-200 transform hover:scale-105 ${colorClasses[form.color]}`}
              >
                <div className="p-6">
                  <div className="flex items-start space-x-4">
                    <div className={`p-4 rounded-lg ${iconColorClasses[form.color]}`}>
                      <Icon className="h-8 w-8" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-gray-900 mb-2">
                        {form.title}
                      </h3>
                      <p className="text-sm text-gray-600 mb-4">
                        {form.description}
                      </p>
                      <div className="flex items-center text-sm font-medium text-gray-700">
                        <span>Click to open form</span>
                        <ArrowLeft className="h-4 w-4 ml-2 rotate-180" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Additional Info */}
        <div className="mt-8 bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Form Information</h3>
          <div className="space-y-2 text-sm text-gray-600">
            <p>
              <strong className="text-gray-900">Item Request Form:</strong> Use this form to request IT equipment, 
              accessories, software, or other technology items. The form includes sections for item specifications, 
              purpose, and approval workflow.
            </p>
            <p>
              <strong className="text-gray-900">Vehicle Request Form:</strong> Use this form to request service 
              vehicles for transportation needs including passenger pickup/drop-off, item delivery, or car-only requests.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FormSelector;
