import React from 'react';
import { X } from 'lucide-react';
import ApproverSignature from './ApproverSignature';

const SignatureModal = ({ 
  isOpen, 
  onClose, 
  value, 
  onChange, 
  approverName = '',
  approverTitle = '',
  label = 'E-Signature',
  onSave
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">
            {label}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
        
        <div className="p-6">
          <div className="mb-4">
            <p className="text-sm text-gray-600">
              {approverName && (
                <>
                  <span className="font-semibold">{approverName}</span>
                  {approverTitle && <span className="ml-2">- {approverTitle}</span>}
                </>
              )}
            </p>
          </div>
          
          <ApproverSignature
            value={value}
            onChange={onChange}
            disabled={false}
            approverName={approverName}
            approverTitle={approverTitle}
            label={label}
          />
          
          <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-200">
            <button
              onClick={onClose}
              className="px-4 py-2 border-2 border-gray-400 rounded text-gray-700 hover:bg-gray-50 text-sm font-semibold"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                if (onSave) onSave();
                onClose();
              }}
              disabled={!value || value.trim() === ''}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold"
            >
              Save Signature
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignatureModal;
