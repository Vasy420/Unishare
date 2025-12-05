import React, { useState, useRef } from 'react';
import { X, Upload, Users, Globe, Lock } from 'lucide-react';

const UploadModal = ({ isOpen, onClose, onUpload, uploading }) => {
    const [file, setFile] = useState(null);
    const [visibility, setVisibility] = useState('public'); // public, private, shared
    const [sharedWith, setSharedWith] = useState('');
    const fileInputRef = useRef(null);

    if (!isOpen) return null;

    const handleFileChange = (e) => {
        if (e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!file) return;

        onUpload(file, {
            isPublic: visibility === 'public',
            sharedWith: visibility === 'shared' ? sharedWith : ''
        });

        // Reset after upload starts (parent handles closing/loading state)
    };

    const handleDrop = (e) => {
        e.preventDefault();
        if (e.dataTransfer.files[0]) {
            setFile(e.dataTransfer.files[0]);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
                <div className="p-6">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Upload File</h2>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full transition-colors"
                        >
                            <X className="w-5 h-5 text-gray-500" />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* File Drop Zone */}
                        <div
                            className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${file ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-300 dark:border-slate-600 hover:border-blue-400'
                                }`}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileChange}
                                className="hidden"
                            />

                            {file ? (
                                <div>
                                    <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/40 rounded-full flex items-center justify-center mx-auto mb-3">
                                        <Upload className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                                    </div>
                                    <p className="font-medium text-gray-900 dark:text-white truncate">{file.name}</p>
                                    <p className="text-sm text-gray-500 mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                                    <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); setFile(null); }}
                                        className="mt-3 text-sm text-red-500 hover:text-red-600"
                                    >
                                        Remove
                                    </button>
                                </div>
                            ) : (
                                <div>
                                    <div className="w-12 h-12 bg-gray-100 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-3">
                                        <Upload className="w-6 h-6 text-gray-400" />
                                    </div>
                                    <p className="font-medium text-gray-900 dark:text-white">Click to upload</p>
                                    <p className="text-sm text-gray-500 mt-1">or drag and drop</p>
                                </div>
                            )}
                        </div>

                        {/* Visibility Settings */}
                        <div className="space-y-3">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Visibility</label>
                            <div className="grid grid-cols-3 gap-2">
                                <button
                                    type="button"
                                    onClick={() => setVisibility('public')}
                                    className={`flex flex-col items-center p-3 rounded-lg border transition-all ${visibility === 'public'
                                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                                            : 'border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600 text-gray-600 dark:text-gray-400'
                                        }`}
                                >
                                    <Globe className="w-5 h-5 mb-1" />
                                    <span className="text-xs font-medium">Public</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setVisibility('private')}
                                    className={`flex flex-col items-center p-3 rounded-lg border transition-all ${visibility === 'private'
                                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                                            : 'border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600 text-gray-600 dark:text-gray-400'
                                        }`}
                                >
                                    <Lock className="w-5 h-5 mb-1" />
                                    <span className="text-xs font-medium">Private</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setVisibility('shared')}
                                    className={`flex flex-col items-center p-3 rounded-lg border transition-all ${visibility === 'shared'
                                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                                            : 'border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600 text-gray-600 dark:text-gray-400'
                                        }`}
                                >
                                    <Users className="w-5 h-5 mb-1" />
                                    <span className="text-xs font-medium">Shared</span>
                                </button>
                            </div>
                        </div>

                        {/* Shared With Input */}
                        {visibility === 'shared' && (
                            <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Share with (email addresses)</label>
                                <input
                                    type="text"
                                    value={sharedWith}
                                    onChange={(e) => setSharedWith(e.target.value)}
                                    placeholder="email@example.com, another@example.com"
                                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                                />
                                <p className="text-xs text-gray-500">Comma separated emails</p>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={!file || uploading}
                            className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium rounded-xl shadow-lg shadow-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform active:scale-[0.98]"
                        >
                            {uploading ? 'Uploading...' : 'Upload File'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default UploadModal;
