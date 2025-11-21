import React, { useRef, useState } from 'react';
import { Upload, X } from 'lucide-react';

const UploadZone = ({ onFileSelect, uploading, disabled }) => {
  const fileInputRef = useRef(null);
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0] && !disabled && !uploading) {
      onFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0] && !disabled && !uploading) {
      onFileSelect(e.target.files[0]);
    }
  };

  const handleClick = () => {
    if (!disabled && !uploading) {
      fileInputRef.current?.click();
    }
  };

  return (
    <div
      className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200 ${
        dragActive
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
          : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500'
      } ${
        disabled || uploading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
      }`}
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
      onClick={handleClick}
    >
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleChange}
        disabled={disabled || uploading}
      />

      <div className="flex flex-col items-center space-y-3">
        <div className={`p-4 rounded-full ${
          dragActive ? 'bg-blue-100 dark:bg-blue-900/50' : 'bg-gray-100 dark:bg-gray-800'
        } transition-colors`}>
          <Upload className={`w-8 h-8 ${
            dragActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'
          }`} />
        </div>
        <div>
          <p className="text-base font-medium text-gray-700 dark:text-gray-300">
            {uploading ? 'Uploading...' : dragActive ? 'Drop your file here' : 'Drop file or click to upload'}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Any file type supported
          </p>
        </div>
      </div>
    </div>
  );
};

export default UploadZone;
