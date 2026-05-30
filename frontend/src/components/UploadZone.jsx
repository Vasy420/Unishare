import React, { useRef, useState } from 'react';
import { Upload } from 'lucide-react';

const UploadZone = ({ onFileSelect, uploading, disabled }) => {
  const fileInputRef = useRef(null);
  const [dragActive, setDragActive] = useState(false);
  const [isFolderDrop, setIsFolderDrop] = useState(false);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
      // Check if it's a folder drop
      const items = e.dataTransfer?.items;
      if (items && items.length > 0) {
        const entry = items[0].webkitGetAsEntry?.();
        setIsFolderDrop(entry?.isDirectory || false);
      }
    } else if (e.type === 'dragleave') {
      setDragActive(false);
      setIsFolderDrop(false);
    }
  };

  // Recursively collect files from a dropped folder
  const traverseFileTree = async (item, path = '') => {
    const files = [];
    
    if (item.isFile) {
      return new Promise((resolve) => {
        item.file((file) => {
          resolve([{ file, relativePath: path }]);
        });
      });
    } else if (item.isDirectory) {
      const dirReader = item.createReader();
      return new Promise((resolve) => {
        const readEntries = () => {
          dirReader.readEntries(async (entries) => {
            if (entries.length === 0) {
              resolve(files);
              return;
            }
            for (const entry of entries) {
              const entryPath = path ? `${path}/${entry.name}` : entry.name;
              const entryFiles = await traverseFileTree(entry, entryPath);
              files.push(...entryFiles);
            }
            readEntries(); // Continue reading (Chrome batches entries)
          });
        };
        readEntries();
      });
    }
    return files;
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (disabled || uploading) return;

    const items = e.dataTransfer?.items;
    if (items && items.length > 0) {
      // Check for folder drop
      const entry = items[0].webkitGetAsEntry?.();
      if (entry && entry.isDirectory) {
        const folderName = entry.name;
        const files = await traverseFileTree(entry);
        if (files.length > 0) {
          onFileSelect({ folderName, files });
        }
        return;
      }
    }

    // Single file drop
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
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
      className={`relative border-2 border-dashed rounded-xl p-4 sm:p-8 text-center transition-all duration-200 touch-manipulation ${
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

      <div className="flex flex-col items-center space-y-2 sm:space-y-3">
        <div className={`p-3 sm:p-4 rounded-full ${
          dragActive ? 'bg-blue-100 dark:bg-blue-900/50' : 'bg-gray-100 dark:bg-gray-800'
        } transition-colors`}>
          <Upload className={`w-6 h-6 sm:w-8 sm:h-8 ${
            dragActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'
          }`} />
        </div>
        <div>
          <p className="text-sm sm:text-base font-medium text-gray-700 dark:text-gray-300">
            {uploading ? 'Uploading...' : dragActive ? (isFolderDrop ? 'Drop folder here' : 'Drop your file here') : 'Tap to upload'}
          </p>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
            Any file type supported
          </p>
        </div>
      </div>
    </div>
  );
};

export default UploadZone;
