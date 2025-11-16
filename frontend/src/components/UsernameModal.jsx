import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { User } from "lucide-react";

const UsernameModal = ({ isOpen, onSubmit }) => {
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!username.trim()) {
      setError("Please enter a username");
      return;
    }

    if (username.length < 3) {
      setError("Username must be at least 3 characters");
      return;
    }

    if (username.length > 20) {
      setError("Username must be less than 20 characters");
      return;
    }

    onSubmit(username.trim());
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent 
        className="sm:max-w-md bg-gradient-to-br from-slate-800/95 to-purple-900/95 backdrop-blur-xl text-white border border-white/20 shadow-2xl"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-white flex items-center gap-2">
            <User className="w-6 h-6 text-purple-400" />
            Welcome to File Sharing
          </DialogTitle>
          <DialogDescription className="text-gray-300">
            Choose a username to get started
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <label htmlFor="username" className="text-sm font-medium text-gray-200">
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setError("");
              }}
              placeholder="Enter your username"
              className="w-full px-4 py-3 bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
              autoFocus
            />
            {error && (
              <p className="text-red-400 text-sm mt-1">{error}</p>
            )}
          </div>

          <button
            type="submit"
            className="w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-lg font-semibold transition-all duration-200 shadow-lg hover:shadow-purple-500/50 transform hover:scale-[1.02]"
          >
            Continue
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default UsernameModal;
