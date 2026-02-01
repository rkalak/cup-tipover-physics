'use client';

import { useCallback, useState } from 'react';
import { Upload, FileType } from 'lucide-react';

interface FileUploadProps {
  onFileLoaded: (buffer: ArrayBuffer, fileName: string) => void;
  isLoading?: boolean;
}

export default function FileUpload({ onFileLoaded, isLoading }: FileUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.endsWith('.ply')) {
      alert('Please upload a .ply file');
      return;
    }

    setFileName(file.name);
    const buffer = await file.arrayBuffer();
    onFileLoaded(buffer, file.name);
  }, [onFileLoaded]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  return (
    <div
      className={`drop-zone p-8 rounded-lg text-center cursor-pointer transition-all ${
        isDragOver ? 'drag-over' : ''
      } ${isLoading ? 'opacity-50 pointer-events-none' : ''}`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onClick={() => document.getElementById('file-input')?.click()}
    >
      <input
        id="file-input"
        type="file"
        accept=".ply"
        className="hidden"
        onChange={handleInputChange}
        disabled={isLoading}
      />

      <div className="flex flex-col items-center gap-3">
        {isLoading ? (
          <>
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-400">Loading splat...</p>
          </>
        ) : fileName ? (
          <>
            <FileType className="w-12 h-12 text-blue-500" />
            <p className="text-gray-300">{fileName}</p>
            <p className="text-sm text-gray-500">Click or drag to replace</p>
          </>
        ) : (
          <>
            <Upload className="w-12 h-12 text-gray-500" />
            <p className="text-gray-300">Drop a .ply file here</p>
            <p className="text-sm text-gray-500">or click to browse</p>
          </>
        )}
      </div>
    </div>
  );
}
