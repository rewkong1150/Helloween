import React, { useState, useEffect } from 'react';
import type { User } from 'firebase/auth';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db, storage } from '../services/firebase';
import type { Costume } from '../types';
import { UploadCloud, Trash2, Wand2 } from 'lucide-react';
import { toast } from './Toast';

interface UploadPageProps {
  user: User;
  existingCostume: Costume | null;
  onCostumeUpdate: (costume: Costume | null) => void;
}

// compressImage สำหรับไฟล์รูป (วีดีโอจะไม่บีบอัด)
const compressImage = (file: File, maxSizeMB = 1): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      return resolve(file); // ถ้าไม่ใช่รูป ให้ return ตรงๆ
    }
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error("Canvas context not available"));

        let width = img.width;
        let height = img.height;
        const maxDimension = 1280;

        if (width > height) {
          if (width > maxDimension) {
            height *= maxDimension / width;
            width = maxDimension;
          }
        } else {
          if (height > maxDimension) {
            width *= maxDimension / height;
            height = maxDimension;
          }
        }
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob && blob.size / 1024 / 1024 < maxSizeMB) {
              resolve(blob);
            } else {
              canvas.toBlob(
                (blob2) => blob2 ? resolve(blob2) : reject(new Error("Image compression failed.")),
                'image/jpeg',
                0.7
              );
            }
          },
          'image/jpeg'
        );
      };
    };
    reader.onerror = error => reject(error);
  });
};

const UploadPage: React.FC<UploadPageProps> = ({ user, existingCostume, onCostumeUpdate }) => {
  const [costumeName, setCostumeName] = useState('');
  const [position, setPosition] = useState('');
  const [uploaderName, setUploaderName] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (existingCostume) {
      setCostumeName(existingCostume.costumeName);
      setPosition(existingCostume.position || '');
      setUploaderName(existingCostume.uploaderName || '');
      setDescription(existingCostume.description || '');
      setPreview(existingCostume.mediaUrl);
    }
  }, [existingCostume]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(selectedFile);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || (!file && !existingCostume) || !costumeName || !position || !uploaderName) {
      toast.error("กรุณาใส่รูป/วีดีโอ, ชื่อชุด, ตำแหน่ง และชื่อผู้อัปโหลด");
      return;
    }
    setIsUploading(true);

    try {
      let mediaUrl = existingCostume?.mediaUrl || '';

      if (file) {
        const uploadFile = file.type.startsWith("image/")
          ? await compressImage(file)
          : file;

        const mediaRef = ref(storage, `costumes/${user.uid}/${file.name}`);
        const snapshot = await uploadBytes(mediaRef, uploadFile);
        mediaUrl = await getDownloadURL(snapshot.ref);
      }

      const costumeData = {
        userId: user.uid,
        userName: user.displayName,
        userPhoto: user.photoURL,
        uploaderName, // เพิ่มชื่อผู้อัพโหลด
        mediaUrl,
        mediaType: file?.type.startsWith("video/") ? "video" : "image",
        costumeName,
        position,
        description: description || '',
        uploadedAt: existingCostume?.uploadedAt || serverTimestamp(),
        voteCount: existingCostume?.voteCount || 0,
      };

      await setDoc(doc(db, 'costumes', user.uid), costumeData);
      onCostumeUpdate({ ...costumeData, id: user.uid } as unknown as Costume);

    } catch (error) {
      console.error("Error uploading costume: ", error);
      toast.error("Failed to upload.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!existingCostume || !window.confirm("Are you sure you want to delete your costume?")) return;
    setIsDeleting(true);
    try {
      const fileRef = ref(storage, existingCostume.mediaUrl);
      await deleteObject(fileRef);
      await deleteDoc(doc(db, 'costumes', user.uid));
      onCostumeUpdate(null);
    } catch (error) {
      console.error("Error deleting costume:", error);
      toast.error("Failed to delete.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto bg-black/50 backdrop-blur-md p-8 rounded-2xl border border-purple-500/50 shadow-lg shadow-purple-500/20">
      <h2 className="font-creepster text-5xl text-center text-orange-500 mb-6">
        {existingCostume ? 'Edit Your Masterpiece' : 'Unveil Your Costume'}
      </h2>
      <form onSubmit={handleSubmit}>
        {/* Upload Media */}
        <div className="mb-6">
          <label htmlFor="costume-file" className="block text-yellow-400 font-bold mb-2">Photo/Video *</label>
          <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-purple-400 border-dashed rounded-md">
            <div className="space-y-1 text-center">
              {preview ? (
                <div className="relative group">
                  {file?.type.startsWith("video/") ? (
                    <video src={preview} controls className="mx-auto h-64 w-auto rounded-md shadow-lg" />
                  ) : (
                    <img src={preview} alt="Preview" className="mx-auto h-64 w-auto rounded-md shadow-lg" />
                  )}
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <label htmlFor="costume-file" className="cursor-pointer text-white font-bold py-2 px-4 rounded-lg bg-orange-600 hover:bg-orange-700">Change</label>
                  </div>
                </div>
              ) : (
                <>
                  <UploadCloud className="mx-auto h-12 w-12 text-gray-400" />
                  <div className="flex text-sm text-gray-400">
                    <label htmlFor="costume-file" className="relative cursor-pointer bg-transparent rounded-md font-medium text-orange-400 hover:text-orange-500">
                      <span>Upload a file</span>
                      <input id="costume-file" name="costume-file" type="file" className="sr-only" onChange={handleFileChange} accept="image/*,video/*" />
                    </label>
                    <p className="pl-1">or drag and drop</p>
                  </div>
                  <p className="text-xs text-gray-500">PNG, JPG, GIF, MP4 up to 50MB</p>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Costume Name */}
        <div className="mb-4">
          <label htmlFor="costumeName" className="block text-yellow-400 font-bold mb-2">Costume Name *</label>
          <input
            type="text"
            id="costumeName"
            value={costumeName}
            onChange={(e) => setCostumeName(e.target.value)}
            required
            className="w-full bg-purple-900/50 border border-purple-600 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>

        {/* Position */}
        <div className="mb-4">
          <label htmlFor="position" className="block text-yellow-400 font-bold mb-2">Position *</label>
          <input
            type="text"
            id="position"
            value={position}
            onChange={(e) => setPosition(e.target.value)}
            required
            className="w-full bg-purple-900/50 border border-purple-600 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>

        {/* Uploader Name */}
        <div className="mb-4">
          <label htmlFor="uploaderName" className="block text-yellow-400 font-bold mb-2">Uploader Name *</label>
          <input
            type="text"
            id="uploaderName"
            value={uploaderName}
            onChange={(e) => setUploaderName(e.target.value)}
            required
            className="w-full bg-purple-900/50 border border-purple-600 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>

        {/* Description (Optional) */}
        <div className="mb-6">
          <label htmlFor="description" className="block text-yellow-400 font-bold mb-2">Description (Optional)</label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="w-full bg-purple-900/50 border border-purple-600 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-orange-500"
          ></textarea>
        </div>

        {/* Buttons */}
        <div className="flex items-center justify-between">
          <button
            type="submit"
            disabled={isUploading}
            className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Wand2 className="mr-2 h-5 w-5" />
            {isUploading ? 'Summoning...' : (existingCostume ? 'Update' : 'Upload')}
          </button>
          {existingCostume && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting}
              className="inline-flex items-center px-4 py-2 border border-red-500 text-sm font-medium rounded-md text-red-400 hover:bg-red-500 hover:text-white disabled:opacity-50"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {isDeleting ? 'Vanishing...' : 'Delete'}
            </button>
          )}
        </div>
      </form>
    </div>
  );
};

export default UploadPage;
