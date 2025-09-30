
import React, { useState, useCallback, useEffect } from 'react';
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

// Helper to compress image
const compressImage = (file: File, maxSizeMB = 1): Promise<Blob> => {
  return new Promise((resolve, reject) => {
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
                // If still too large, reduce quality
                canvas.toBlob(
                    (blob) => {
                        if (blob) resolve(blob);
                        else reject(new Error("Image compression failed."));
                    },
                    'image/jpeg',
                    0.7 // 70% quality
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
  const [description, setDescription] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (existingCostume) {
      setCostumeName(existingCostume.costumeName);
      setDescription(existingCostume.description);
      setImagePreview(existingCostume.costumeImage);
    }
  }, [existingCostume]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || (!imageFile && !existingCostume)) {
      toast.error("Please provide an image and details.");
      return;
    }
    setIsUploading(true);

    try {
      let imageUrl = existingCostume?.costumeImage || '';
      
      if (imageFile) {
        const compressedBlob = await compressImage(imageFile);
        const imageRef = ref(storage, `costumes/${user.uid}/${imageFile.name}`);
        const snapshot = await uploadBytes(imageRef, compressedBlob);
        imageUrl = await getDownloadURL(snapshot.ref);
      }
      
      const costumeData = {
        userId: user.uid,
        userName: user.displayName,
        userPhoto: user.photoURL,
        costumeImage: imageUrl,
        costumeName,
        description,
        uploadedAt: existingCostume?.uploadedAt || serverTimestamp(),
        voteCount: existingCostume?.voteCount || 0,
      };

      await setDoc(doc(db, 'costumes', user.uid), costumeData);
      onCostumeUpdate({ ...costumeData, id: user.uid } as Costume);

    } catch (error) {
      console.error("Error uploading costume: ", error);
      toast.error("Failed to upload costume.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!existingCostume || !window.confirm("Are you sure you want to delete your costume? This cannot be undone.")) return;
    setIsDeleting(true);
    try {
        const imageRef = ref(storage, existingCostume.costumeImage);
        await deleteObject(imageRef);
        await deleteDoc(doc(db, 'costumes', user.uid));
        onCostumeUpdate(null);
    } catch(error) {
        console.error("Error deleting costume:", error);
        toast.error("Failed to delete costume. Please try again.");
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
        <div className="mb-6">
          <label htmlFor="costume-image" className="block text-yellow-400 font-bold mb-2">Costume Photo</label>
          <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-purple-400 border-dashed rounded-md">
            <div className="space-y-1 text-center">
              {imagePreview ? (
                <div className="relative group">
                  <img src={imagePreview} alt="Costume preview" className="mx-auto h-64 w-auto rounded-md shadow-lg" />
                   <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <label htmlFor="costume-image" className="cursor-pointer text-white font-bold py-2 px-4 rounded-lg bg-orange-600 hover:bg-orange-700">Change Image</label>
                   </div>
                </div>
              ) : (
                <>
                  <UploadCloud className="mx-auto h-12 w-12 text-gray-400" />
                  <div className="flex text-sm text-gray-400">
                    <label htmlFor="costume-image" className="relative cursor-pointer bg-transparent rounded-md font-medium text-orange-400 hover:text-orange-500 focus-within:outline-none">
                      <span>Upload a file</span>
                      <input id="costume-image" name="costume-image" type="file" className="sr-only" onChange={handleFileChange} accept="image/*" />
                    </label>
                    <p className="pl-1">or drag and drop</p>
                  </div>
                  <p className="text-xs text-gray-500">PNG, JPG, GIF up to 10MB</p>
                </>
              )}
            </div>
          </div>
          <input id="costume-image" name="costume-image" type="file" className="sr-only" onChange={handleFileChange} accept="image/*" />
        </div>

        <div className="mb-4">
          <label htmlFor="costumeName" className="block text-yellow-400 font-bold mb-2">Costume Name</label>
          <input type="text" id="costumeName" value={costumeName} onChange={(e) => setCostumeName(e.target.value)} required className="w-full bg-purple-900/50 border border-purple-600 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-orange-500" />
        </div>

        <div className="mb-6">
          <label htmlFor="description" className="block text-yellow-400 font-bold mb-2">Description</label>
          <textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} required rows={4} className="w-full bg-purple-900/50 border border-purple-600 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-orange-500"></textarea>
        </div>

        <div className="flex items-center justify-between">
          <button type="submit" disabled={isUploading} className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed">
            <Wand2 className="mr-2 h-5 w-5" />
            {isUploading ? 'Summoning...' : (existingCostume ? 'Update Costume' : 'Upload Costume')}
          </button>
          {existingCostume && (
            <button type="button" onClick={handleDelete} disabled={isDeleting} className="inline-flex items-center px-4 py-2 border border-red-500 text-sm font-medium rounded-md text-red-400 hover:bg-red-500 hover:text-white disabled:opacity-50">
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
