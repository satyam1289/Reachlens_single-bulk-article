import React, { useState, useRef } from 'react';
import { Upload, FileSpreadsheet, Download, Loader2, AlertCircle } from 'lucide-react';
import { analyzeBulk } from '../api';

interface Props {
    version: string;
}

export const BulkUpload: React.FC<Props> = ({ version }) => {
    const [file, setFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            if (selectedFile.name.endsWith('.xlsx') || selectedFile.name.endsWith('.xls')) {
                setFile(selectedFile);
                setError('');
                setSuccess(false);
                setDownloadUrl(null);
            } else {
                setError('Please upload a valid Excel file (.xlsx or .xls)');
                setFile(null);
            }
        }
    };

    const handleUpload = async () => {
        if (!file) return;

        setLoading(true);
        setError('');
        setSuccess(false);
        setDownloadUrl(null);

        try {
            const blob = await analyzeBulk(file, version);
            const url = window.URL.createObjectURL(blob);
            setDownloadUrl(url);
            setSuccess(true);
        } catch (err) {
            setError('Bulk analysis failed. Please ensure the Excel file contains valid URLs in the first column.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleDownload = () => {
        if (!downloadUrl) return;
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `reachlens_bulk_analysis_${new Date().getTime()}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    const triggerFileInput = () => {
        fileInputRef.current?.click();
    };

    return (
        <div className="w-full max-w-2xl mx-auto bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden transition-all duration-300">
            <div className="p-8">
                <div className="flex items-center space-x-3 mb-6">
                    <div className="bg-blue-100 p-2 rounded-lg">
                        <FileSpreadsheet className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-gray-900">Bulk Analysis</h3>
                        <p className="text-sm text-gray-500">Upload an Excel file with URLs in the first column</p>
                    </div>
                </div>

                <div 
                    onClick={triggerFileInput}
                    className={`relative border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center cursor-pointer transition-all duration-300 ${
                        file ? 'border-blue-400 bg-blue-50/30' : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                    }`}
                >
                    <input 
                        type="file" 
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept=".xlsx, .xls"
                        className="hidden"
                    />
                    
                    {file ? (
                        <div className="flex flex-col items-center space-y-3">
                            <div className="bg-blue-600 p-3 rounded-full shadow-lg">
                                <FileSpreadsheet className="w-8 h-8 text-white" />
                            </div>
                            <div className="text-center">
                                <p className="font-semibold text-gray-900">{file.name}</p>
                                <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)} KB • Ready to process</p>
                            </div>
                            <button 
                                onClick={(e) => { e.stopPropagation(); setFile(null); }}
                                className="text-xs text-red-500 hover:underline mt-2 font-medium"
                            >
                                Remove file
                            </button>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center space-y-3">
                            <div className="bg-gray-100 p-4 rounded-full group-hover:bg-blue-100 transition-colors">
                                <Upload className="w-8 h-8 text-gray-400 group-hover:text-blue-500 transition-colors" />
                            </div>
                            <div className="text-center">
                                <p className="font-medium text-gray-700">Click to upload or drag and drop</p>
                                <p className="text-xs text-gray-400 mt-1">Microsoft Excel (.xlsx, .xls)</p>
                            </div>
                        </div>
                    )}
                </div>

                {error && (
                    <div className="mt-6 flex items-center space-x-2 text-red-600 bg-red-50 p-4 rounded-lg border border-red-100 animate-fade-in">
                        <AlertCircle className="w-5 h-5 flex-shrink-0" />
                        <p className="text-sm font-medium">{error}</p>
                    </div>
                )}

                {success && downloadUrl && (
                    <div className="mt-6 flex flex-col items-center space-y-4 bg-green-50 p-6 rounded-xl border border-green-100 animate-fade-in">
                        <div className="flex items-center space-x-2 text-green-600">
                            <Download className="w-5 h-5 flex-shrink-0" />
                            <p className="text-sm font-bold">Analysis Complete!</p>
                        </div>
                        <button
                            onClick={handleDownload}
                            className="flex items-center space-x-2 bg-green-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-green-700 shadow-md transition-all active:scale-95"
                        >
                            <Download className="w-5 h-5" />
                            <span>Download Analysis Report</span>
                        </button>
                    </div>
                )}

                <div className="mt-8">
                    {!success && (
                        <button
                            onClick={handleUpload}
                            disabled={!file || loading}
                            className={`w-full py-4 rounded-xl font-bold text-lg shadow-lg transition-all duration-300 flex items-center justify-center space-x-3 ${
                                !file || loading
                                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'
                                    : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 hover:shadow-xl active:scale-[0.98]'
                            }`}
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-6 h-6 animate-spin" />
                                    <span>Processing Multi-URL Matrix...</span>
                                </>
                            ) : (
                                <>
                                    <Loader2 className="w-6 h-6" />
                                    <span>Run Bulk Analysis</span>
                                </>
                            )}
                        </button>
                    )}
                    
                    {success && (
                        <button
                            onClick={() => {
                                setFile(null);
                                setSuccess(false);
                                setDownloadUrl(null);
                            }}
                            className="w-full py-4 rounded-xl font-bold text-lg border-2 border-gray-200 text-gray-600 hover:bg-gray-50 transition-all"
                        >
                            Analyze Another File
                        </button>
                    )}
                    {loading && (
                        <p className="text-center text-xs text-gray-400 mt-4 animate-pulse">
                            This may take a few minutes depending on the number of URLs.
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};
