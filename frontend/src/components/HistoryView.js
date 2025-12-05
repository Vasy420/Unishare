import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { History, Upload, Download, Eye, Clock, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

const HistoryView = ({ token }) => {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchHistory();
    }, [token]);

    const fetchHistory = async () => {
        try {
            setLoading(true);
            const response = await axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/history`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setHistory(response.data);
        } catch (err) {
            console.error('Failed to fetch history:', err);
        } finally {
            setLoading(false);
        }
    };

    const getActionIcon = (action) => {
        switch (action) {
            case 'upload': return <Upload className="w-4 h-4 text-green-500" />;
            case 'download': return <Download className="w-4 h-4 text-blue-500" />;
            case 'view': return <Eye className="w-4 h-4 text-purple-500" />;
            default: return <Clock className="w-4 h-4 text-gray-500" />;
        }
    };

    const getActionText = (action) => {
        switch (action) {
            case 'upload': return 'Uploaded file';
            case 'download': return 'Downloaded file';
            case 'view': return 'Viewed file';
            default: return action;
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-4" />
                <p className="text-gray-500">Loading history...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center space-x-3">
                <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                    <History className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Activity History</h2>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
                {history.length === 0 ? (
                    <div className="text-center p-12">
                        <p className="text-gray-500">No activity recorded yet</p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-200 dark:divide-slate-700">
                        {history.map((item) => (
                            <div key={item.id} className="p-4 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-4">
                                        <div className="p-2 bg-gray-100 dark:bg-slate-700 rounded-full">
                                            {getActionIcon(item.action)}
                                        </div>
                                        <div>
                                            <p className="font-medium text-gray-900 dark:text-white">
                                                {getActionText(item.action)}: <span className="text-blue-600 dark:text-blue-400">{item.file_name}</span>
                                            </p>
                                            {item.details && (
                                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                                    {item.details}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="text-sm text-gray-500 dark:text-gray-400">
                                        {format(new Date(item.timestamp), 'MMM d, yyyy HH:mm')}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default HistoryView;
