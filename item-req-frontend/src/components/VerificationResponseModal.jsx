import React, { useState, useEffect } from 'react';
import { X, CheckCircle, XCircle } from 'lucide-react';

const VerificationResponseModal = ({ isOpen, onClose, onConfirm, action, loading }) => {
    const [comments, setComments] = useState('');

    useEffect(() => {
        if (isOpen) {
            setComments('');
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const isVerify = action === 'verify';
    const title = isVerify ? 'Verify Request' : 'Decline Verification';
    const colorClass = isVerify ? 'green' : 'red';
    const Icon = isVerify ? CheckCircle : XCircle;

    const handleSubmit = () => {
        onConfirm(comments);
    };

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
                            <div className={`mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-${colorClass}-100 sm:mx-0 sm:h-10 sm:w-10`}>
                                <Icon className={`h-6 w-6 text-${colorClass}-600`} />
                            </div>
                            <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                                <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                                    {title}
                                </h3>
                                <div className="mt-2">
                                    <p className="text-sm text-gray-500 mb-4">
                                        {isVerify
                                            ? "Are you sure you want to verify this request? You can add optional notes below."
                                            : "Please provide a reason for declining the verification."}
                                    </p>

                                    <textarea
                                        className="w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                                        rows="4"
                                        placeholder={isVerify ? "Optional notes..." : "Reason for decline (required)..."}
                                        value={comments}
                                        onChange={(e) => setComments(e.target.value)}
                                    ></textarea>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                        <button
                            type="button"
                            className={`w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-${colorClass}-600 text-base font-medium text-white hover:bg-${colorClass}-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-${colorClass}-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50`}
                            onClick={handleSubmit}
                            disabled={loading || (!isVerify && !comments.trim())}
                        >
                            {loading ? 'Processing...' : isVerify ? 'Confirm Verify' : 'Decline'}
                        </button>
                        <button
                            type="button"
                            className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                            onClick={onClose}
                            disabled={loading}
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default VerificationResponseModal;
