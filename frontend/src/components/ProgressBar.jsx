import React from "react";
import { Progress } from "@/components/ui/progress";

const ProgressBar = ({ progress, speed, timeRemaining, fileName, operation = "Uploading" }) => {
  const formatSpeed = (bytesPerSecond) => {
    if (!bytesPerSecond || bytesPerSecond === 0) return "0 KB/s";
    
    const kb = bytesPerSecond / 1024;
    const mb = kb / 1024;
    
    if (mb >= 1) {
      return `${mb.toFixed(2)} MB/s`;
    }
    return `${kb.toFixed(2)} KB/s`;
  };

  const formatTime = (seconds) => {
    if (!seconds || seconds === Infinity || isNaN(seconds)) return "Calculating...";
    
    if (seconds < 60) {
      return `${Math.round(seconds)}s`;
    }
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);
    return `${minutes}m ${remainingSeconds}s`;
  };

  return (
    <div className="fixed bottom-4 right-4 w-96 bg-slate-800 border border-slate-700 rounded-lg shadow-2xl p-4 z-50 animate-in slide-in-from-bottom-5">
      <div className="space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{operation}</p>
            <p className="text-xs text-gray-400 truncate mt-1">{fileName}</p>
          </div>
          <span className="text-sm font-semibold text-purple-400 ml-2">{progress}%</span>
        </div>

        <Progress value={progress} className="h-2" />

        <div className="flex items-center justify-between text-xs text-gray-400">
          <span className="flex items-center space-x-1">
            <span className="text-green-400">↑</span>
            <span>{formatSpeed(speed)}</span>
          </span>
          <span>{formatTime(timeRemaining)} remaining</span>
        </div>
      </div>
    </div>
  );
};

export default ProgressBar;
