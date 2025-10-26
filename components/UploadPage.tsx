import React, { useState, useEffect } from 'react';
import type { User } from 'firebase/auth';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db, storage } from '../services/firebase';
import type { Costume } from '../types';
import { UploadCloud, Trash2, Wand2, Clock, Calendar } from 'lucide-react';
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
      return resolve(file);
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
  const [uploadStatus, setUploadStatus] = useState<'before' | 'during' | 'after'>('before');

  // กำหนดช่วงเวลา (ใช้ปี 2024)
  const UPLOAD_START = new Date('2024-10-31T00:00:00+07:00');
  const UPLOAD_END = new Date('2024-11-02T23:59:59+07:00');

  useEffect(() => {
    if (existingCostume) {
      setCostumeName(existingCostume.costumeName);
      setPosition(existingCostume.position || '');
      setUploaderName(existingCostume.uploaderName || '');
      setDescription(existingCostume.description || '');
      setPreview(existingCostume.mediaUrl);
    }
  }, [existingCostume]);

  useEffect(() => {
    const checkUploadTime = () => {
      const now = new Date();
      
      if (now < UPLOAD_START) {
        setUploadStatus('before');
      } else if (now > UPLOAD_END) {
        setUploadStatus('after');
      } else {
        setUploadStatus('during');
      }
    };

    checkUploadTime();
    const interval = setInterval(checkUploadTime, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (uploadStatus !== 'during') {
      toast.error(getTimeMessage().error);
      return;
    }

    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      // ตรวจสอบขนาดไฟล์ (50MB)
      if (selectedFile.size > 50 * 1024 * 1024) {
        toast.error("ไฟล์มีขนาดใหญ่เกิน 50MB / File size exceeds 50MB");
        return;
      }
      
      setFile(selectedFile);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(selectedFile);
    }
  };

  const getTimeMessage = () => {
    const now = new Date();
    
    if (now < UPLOAD_START) {
      return {
        type: 'info' as const,
        title: 'ยังไม่ถึงเวลาอัปโหลด / Upload Time Not Started',
        message: `สามารถอัปโหลดได้ตั้งแต่ 31 ตุลาคม 00:00 น. ถึง 2 พฤศจิกายน 23:59 น. / Upload opens from Oct 31 00:00 to Nov 2 23:59`,
        error: "ยังไม่ถึงเวลาอัปโหลด / Upload time hasn't started yet"
      };
    } else if (now > UPLOAD_END) {
      return {
        type: 'error' as const,
        title: 'หมดเวลาอัปโหลดแล้ว / Upload Time Has Ended',
        message: `เวลาอัปโหลดสิ้นสุดลงแล้ว (2 พฤศจิกายน 23:59 น.) / Upload time has ended (Nov 2 23:59)`,
        error: "หมดเวลาอัปโหลดแล้ว / Upload time has ended"
      };
    } else {
      return {
        type: 'success' as const,
        title: 'กำลังเปิดรับอัปโหลด! / Upload Time is Open!',
        message: `อัปโหลดได้จนถึง 2 พฤศจิกายน 23:59 น. / Upload until Nov 2 23:59`,
        error: ""
      };
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const timeMessage = getTimeMessage();
    if (uploadStatus !== 'during') {
      toast.error(timeMessage.error);
      return;
    }

    if (!user) {
      toast.error("กรุณาเข้าสู่ระบบ / Please login first");
      return;
    }

    if (!file && !existingCostume) {
      toast.error("กรุณาเลือกไฟล์รูปหรือวิดีโอ / Please select a photo or video");
      return;
    }

    if (!costumeName.trim()) {
      toast.error("กรุณากรอกชื่อชุด / Please enter costume name");
      return;
    }

    if (!position.trim()) {
      toast.error("กรุณากรอกตำแหน่ง / Please enter position");
      return;
    }

    if (!uploaderName.trim()) {
      toast.error("กรุณากรอกชื่อผู้อัปโหลด / Please enter uploader name");
      return;
    }

    setIsUploading(true);

    try {
      let mediaUrl = existingCostume?.mediaUrl || '';
      let mediaType = existingCostume?.mediaType || 'image';

      // อัปโหลดไฟล์ใหม่ถ้ามี
      if (file) {
        // ลบไฟล์เก่าถ้ามี
        if (existingCostume?.mediaUrl) {
          try {
            const oldFileRef = ref(storage, existingCostume.mediaUrl);
            await deleteObject(oldFileRef);
          } catch (error) {
            console.log("Error deleting old file:", error);
          }
        }

        const uploadFile = file.type.startsWith("image/")
          ? await compressImage(file)
          : file;

        const timestamp = Date.now();
        const fileExtension = file.name.split('.').pop();
        const fileName = `costume_${timestamp}.${fileExtension}`;
        
        const mediaRef = ref(storage, `costumes/${user.uid}/${fileName}`);
        const snapshot = await uploadBytes(mediaRef, uploadFile);
        mediaUrl = await getDownloadURL(snapshot.ref);
        mediaType = file.type.startsWith("video/") ? "video" : "image";
      }

      const costumeData = {
        userId: user.uid,
        userName: user.displayName || '',
        userPhoto: user.photoURL || '',
        uploaderName: uploaderName.trim(),
        mediaUrl,
        mediaType,
        costumeName: costumeName.trim(),
        position: position.trim(),
        description: description.trim(),
        uploadedAt: existingCostume?.uploadedAt || serverTimestamp(),
        updatedAt: serverTimestamp(),
        voteCount: existingCostume?.voteCount || 0,
      };

      await setDoc(doc(db, 'costumes', user.uid), costumeData);
      
      const updatedCostume = {
        ...costumeData,
        id: user.uid,
        uploadedAt: existingCostume?.uploadedAt || new Date(),
      } as unknown as Costume;
      
      onCostumeUpdate(updatedCostume);
      toast.success("อัปโหลดสำเร็จแล้ว! / Upload successful!");

    } catch (error) {
      console.error("Error uploading costume: ", error);
      toast.error("อัปโหลดล้มเหลว / Failed to upload.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async () => {
    const timeMessage = getTimeMessage();
    if (uploadStatus !== 'during') {
      toast.error(timeMessage.error);
      return;
    }

    if (!existingCostume) return;
    
    const confirmMessage = "คุณแน่ใจหรือไม่ว่าต้องการลบชุดของคุณ? / Are you sure you want to delete your costume?";
    if (!window.confirm(confirmMessage)) return;
    
    setIsDeleting(true);
    try {
      // ลบไฟล์จาก storage
      if (existingCostume.mediaUrl) {
        const fileRef = ref(storage, existingCostume.mediaUrl);
        await deleteObject(fileRef);
      }
      
      // ลบข้อมูลจาก firestore
      await deleteDoc(doc(db, 'costumes', user.uid));
      onCostumeUpdate(null);
      
      // รีเซ็ตฟอร์ม
      setCostumeName('');
      setPosition('');
      setUploaderName('');
      setDescription('');
      setFile(null);
      setPreview(null);
      
      toast.success("ลบชุดสำเร็จแล้ว! / Costume deleted successfully!");
    } catch (error) {
      console.error("Error deleting costume:", error);
      // ถ้าลบไฟล์ไม่สำเร็จ แต่ลบ document สำเร็จ
      if (error instanceof Error && 'code' in error && error.code === 'storage/object-not-found') {
        await deleteDoc(doc(db, 'costumes', user.uid));
        onCostumeUpdate(null);
        toast.success("ลบชุดสำเร็จแล้ว! / Costume deleted successfully!");
      } else {
        toast.error("ลบชุดล้มเหลว / Failed to delete.");
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const timeMessage = getTimeMessage();
  const isFormDisabled = uploadStatus !== 'during';

  return (
    <div className="max-w-2xl mx-auto bg-black/50 backdrop-blur-md p-8 rounded-2xl border border-purple-500/50 shadow-lg shadow-purple-500/20">
      <h2 className="font-creepster text-5xl text-center text-orange-500 mb-6">
        {existingCostume ? 'Edit Your Masterpiece' : 'Unveil Your Costume'}
      </h2>
      
      {/* Time Status Banner */}
      <div className={`mb-6 p-4 rounded-lg border ${
        timeMessage.type === 'info' 
          ? 'bg-blue-500/20 border-blue-500/50' 
          : timeMessage.type === 'success'
          ? 'bg-green-500/20 border-green-500/50'
          : 'bg-red-500/20 border-red-500/50'
      }`}>
        <div className="flex items-center gap-2 mb-2">
          <Calendar className="h-5 w-5" />
          <h3 className="font-bold text-lg">{timeMessage.title}</h3>
        </div>
        <div className="flex items-start gap-2 text-sm">
          <Clock className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <p>{timeMessage.message}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Upload Media */}
        <div className="mb-6">
          <label htmlFor="costume-file" className="block text-yellow-400 font-bold mb-2">
            Photo/Video *
          </label>
          <div className={`mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-dashed rounded-md ${
            isFormDisabled ? 'border-gray-500 bg-gray-800/20' : 'border-purple-400'
          }`}>
            <div className="space-y-1 text-center">
              {preview ? (
                <div className="relative group">
                  {existingCostume?.mediaType === 'video' || file?.type.startsWith('video/') ? (
                    <video 
                      src={preview} 
                      controls 
                      className="mx-auto h-64 w-auto rounded-md shadow-lg max-w-full object-contain"
                    />
                  ) : (
                    <img 
                      src={preview} 
                      alt="Preview" 
                      className="mx-auto h-64 w-auto rounded-md shadow-lg max-w-full object-contain"
                    />
                  )}
                  {!isFormDisabled && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <label htmlFor="costume-file" className="cursor-pointer text-white font-bold py-2 px-4 rounded-lg bg-orange-600 hover:bg-orange-700">
                        Change
                      </label>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <UploadCloud className={`mx-auto h-12 w-12 ${isFormDisabled ? 'text-gray-500' : 'text-gray-400'}`} />
                  <div className="flex text-sm text-gray-400">
                    <label 
                      htmlFor="costume-file" 
                      className={`relative cursor-pointer bg-transparent rounded-md font-medium ${
                        isFormDisabled 
                          ? 'text-gray-500 cursor-not-allowed' 
                          : 'text-orange-400 hover:text-orange-500'
                      }`}
                    >
                      <span>Upload a file</span>
                      <input 
                        id="costume-file" 
                        name="costume-file" 
                        type="file" 
                        className="sr-only" 
                        onChange={handleFileChange} 
                        accept="image/*,video/*" 
                        disabled={isFormDisabled}
                      />
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
          <label htmlFor="costumeName" className="block text-yellow-400 font-bold mb-2">
            Costume Name *
          </label>
          <input
            type="text"
            id="costumeName"
            value={costumeName}
            onChange={(e) => setCostumeName(e.target.value)}
            required
            disabled={isFormDisabled}
            className="w-full bg-purple-900/50 border border-purple-600 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>

        {/* Position */}
        <div className="mb-4">
          <label htmlFor="position" className="block text-yellow-400 font-bold mb-2">
            Position *
          </label>
          <input
            type="text"
            id="position"
            value={position}
            onChange={(e) => setPosition(e.target.value)}
            required
            disabled={isFormDisabled}
            className="w-full bg-purple-900/50 border border-purple-600 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>

        {/* Uploader Name */}
        <div className="mb-4">
          <label htmlFor="uploaderName" className="block text-yellow-400 font-bold mb-2">
            Your Name *
          </label>
          <input
            type="text"
            id="uploaderName"
            value={uploaderName}
            onChange={(e) => setUploaderName(e.target.value)}
            required
            disabled={isFormDisabled}
            className="w-full bg-purple-900/50 border border-purple-600 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>

        {/* Description (Optional) */}
        <div className="mb-6">
          <label htmlFor="description" className="block text-yellow-400 font-bold mb-2">
            Description (Optional)
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            disabled={isFormDisabled}
            className="w-full bg-purple-900/50 border border-purple-600 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>

        {/* Buttons */}
        <div className="flex items-center justify-between">
          <button
            type="submit"
            disabled={isUploading || isFormDisabled}
            className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
          >
            <Wand2 className="mr-2 h-5 w-5" />
            {isUploading ? 'Summoning...' : (existingCostume ? 'Update' : 'Upload')}
          </button>
          {existingCostume && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting || isFormDisabled}
              className="inline-flex items-center px-4 py-2 border border-red-500 text-sm font-medium rounded-md text-red-400 hover:bg-red-500 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
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