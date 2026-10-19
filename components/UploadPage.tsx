import React, { useState, useEffect } from 'react';
import { supabase, MEDIA_BUCKET } from '../services/supabase';
import { rowToCostume, type EntryRow } from '../services/entries';
import type { AppUser, Costume, Category } from '../types';
import { CATEGORIES, getCategoryInfo, UPLOAD_START, UPLOAD_END } from '../config';
import { UploadCloud, Trash2, Wand2, Clock, Calendar } from 'lucide-react';
import { toast } from './Toast';

interface UploadPageProps {
  user: AppUser;
  existingCostumes: Costume[];
  onCostumeUpdate: (category: Category, costume: Costume | null) => void;
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
          'image/jpeg',
          0.82
        );
      };
    };
    reader.onerror = error => reject(error);
  });
};

// Videos are stored as-is, so keep them small (the storage bucket enforces the same limit).
const MAX_VIDEO_MB = 20;
const MAX_IMAGE_INPUT_MB = 50;
const THUMB_MAX = 480;

const canvasToJpeg = (source: CanvasImageSource, w: number, h: number, maxDim: number, quality: number): Promise<Blob | null> => {
  const scale = Math.min(1, maxDim / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.resolve(null);
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/jpeg', quality));
};

// Small JPEG used by the gallery. For videos it is a still frame, so the gallery never downloads clips.
// Resolves to null if the browser cannot decode the file (the gallery then falls back to the original).
const makeThumbnail = (file: File): Promise<Blob | null> =>
  new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const done = (blob: Blob | null) => {
      URL.revokeObjectURL(url);
      resolve(blob);
    };
    setTimeout(() => done(null), 10000);
    if (file.type.startsWith('image/')) {
      const img = new Image();
      img.onload = () => canvasToJpeg(img, img.naturalWidth, img.naturalHeight, THUMB_MAX, 0.7).then(done);
      img.onerror = () => done(null);
      img.src = url;
    } else {
      const video = document.createElement('video');
      video.muted = true;
      video.playsInline = true;
      video.preload = 'auto';
      video.onloadeddata = () => {
        video.currentTime = Math.min(0.5, (video.duration || 1) / 2);
      };
      video.onseeked = () => canvasToJpeg(video, video.videoWidth, video.videoHeight, THUMB_MAX, 0.7).then(done);
      video.onerror = () => done(null);
      video.src = url;
    }
  });

const UploadPage: React.FC<UploadPageProps> = ({ user, existingCostumes, onCostumeUpdate }) => {
  const [category, setCategory] = useState<Category>('costume');
  const categoryInfo = getCategoryInfo(category);
  const existingCostume = existingCostumes.find((c) => c.category === category) ?? null;
  const [costumeName, setCostumeName] = useState('');
  const [position, setPosition] = useState('');
  const [uploaderName, setUploaderName] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'before' | 'during' | 'after'>('before');

  useEffect(() => {
    setCostumeName(existingCostume?.costumeName ?? '');
    setPosition(existingCostume?.position ?? '');
    setUploaderName(existingCostume?.uploaderName ?? '');
    setDescription(existingCostume?.description ?? '');
    setFile(null);
    setPreview(existingCostume?.mediaUrl ?? null);
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
      // ตรวจสอบขนาดไฟล์: รูปถูกย่ออัตโนมัติ, วิดีโอจำกัด 20MB
      const isVideo = selectedFile.type.startsWith('video/');
      const limitMB = isVideo ? MAX_VIDEO_MB : MAX_IMAGE_INPUT_MB;
      if (selectedFile.size > limitMB * 1024 * 1024) {
        toast.error(isVideo
          ? `วิดีโอใหญ่เกิน ${MAX_VIDEO_MB}MB / Video exceeds ${MAX_VIDEO_MB}MB`
          : `รูปใหญ่เกิน ${MAX_IMAGE_INPUT_MB}MB / Image exceeds ${MAX_IMAGE_INPUT_MB}MB`);
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
      message: `สามารถอัปโหลดได้ตั้งแต่ 19 ตุลาคม 2026 00:00 น. ถึง 29 ตุลาคม 2026 23:59 น. / Upload opens from Oct 19, 2026 00:00 to Oct 29, 2026 23:59`,
      error: "ยังไม่ถึงเวลาอัปโหลด / Upload time hasn't started yet"
    };
  } else if (now > UPLOAD_END) {
    return {
      type: 'error' as const,
      title: 'หมดเวลาอัปโหลดแล้ว / Upload Time Has Ended',
      message: `เวลาอัปโหลดสิ้นสุดลงแล้ว (29 ตุลาคม 2026 23:59 น.) / Upload time has ended (Oct 29, 2026 23:59)`,
      error: "หมดเวลาอัปโหลดแล้ว / Upload time has ended"
    };
  } else {
    return {
      type: 'success' as const,
      title: 'กำลังเปิดรับอัปโหลด! / Upload Time is Open!',
      message: `อัปโหลดได้จนถึง 29 ตุลาคม 2026 23:59 น. / Upload until Oct 29, 2026 23:59`,
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
      toast.error("กรุณากรอกชื่อผลงาน / Please enter entry name");
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
      let mediaPath = existingCostume?.mediaPath || '';
      let mediaType: 'image' | 'video' = existingCostume?.mediaType || 'image';
      let thumbUrl = existingCostume?.thumbUrl || null;
      let thumbPath = existingCostume?.thumbPath || null;

      // อัปโหลดไฟล์ใหม่ถ้ามี
      if (file) {
        const uploadFile = file.type.startsWith("image/")
          ? await compressImage(file)
          : file;

        const stamp = Date.now();
        // Photos are re-encoded as JPEG above, so name them accordingly.
        const fileExtension = file.type.startsWith('image/') ? 'jpg' : (file.name.split('.').pop() || 'bin').toLowerCase();
        const newPath = `${user.uid}/${category}_${stamp}.${fileExtension}`;
        // File names are unique per upload, so they can be cached for a year (saves download quota).
        const { error: uploadError } = await supabase.storage
          .from(MEDIA_BUCKET)
          .upload(newPath, uploadFile, { contentType: uploadFile.type || file.type, cacheControl: '31536000' });
        if (uploadError) throw uploadError;

        // รูปย่อสำหรับหน้าแกลเลอรี (ถ้าสร้างไม่ได้ จะใช้ไฟล์จริงแทน)
        let newThumbPath: string | null = null;
        const thumb = await makeThumbnail(file);
        if (thumb) {
          const path = `${user.uid}/${category}_${stamp}_thumb.jpg`;
          const { error: thumbError } = await supabase.storage
            .from(MEDIA_BUCKET)
            .upload(path, thumb, { contentType: 'image/jpeg', cacheControl: '31536000' });
          if (thumbError) console.warn('Could not upload the thumbnail:', thumbError);
          else newThumbPath = path;
        }

        // ลบไฟล์เก่าหลังอัปโหลดใหม่สำเร็จ
        const oldPaths = [existingCostume?.mediaPath, existingCostume?.thumbPath].filter((x): x is string => !!x);
        if (oldPaths.length) {
          const { error: removeError } = await supabase.storage.from(MEDIA_BUCKET).remove(oldPaths);
          if (removeError) console.warn('Could not remove the old files:', removeError);
        }

        mediaPath = newPath;
        mediaUrl = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(newPath).data.publicUrl;
        mediaType = file.type.startsWith("video/") ? "video" : "image";
        thumbPath = newThumbPath;
        thumbUrl = newThumbPath ? supabase.storage.from(MEDIA_BUCKET).getPublicUrl(newThumbPath).data.publicUrl : null;
      }

      const { data, error } = await supabase
        .from('entries')
        .upsert(
          {
            user_id: user.uid,
            category,
            user_name: user.displayName,
            user_photo: user.photoURL,
            uploader_name: uploaderName.trim(),
            name: costumeName.trim(),
            position: position.trim(),
            description: description.trim(),
            media_url: mediaUrl,
            media_path: mediaPath,
            media_type: mediaType,
            thumb_url: thumbUrl,
            thumb_path: thumbPath,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,category' }
        )
        .select()
        .single();
      if (error) throw error;

      onCostumeUpdate(category, rowToCostume(data as EntryRow));
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
    
    const confirmMessage = "คุณแน่ใจหรือไม่ว่าต้องการลบผลงานนี้? / Are you sure you want to delete this entry?";
    if (!window.confirm(confirmMessage)) return;
    
    setIsDeleting(true);
    try {
      // ลบข้อมูลก่อน แล้วค่อยลบไฟล์จาก storage
      const { error } = await supabase.from('entries').delete().eq('id', existingCostume.id);
      if (error) throw error;
      const paths = [existingCostume.mediaPath, existingCostume.thumbPath].filter((x): x is string => !!x);
      if (paths.length) {
        const { error: removeError } = await supabase.storage.from(MEDIA_BUCKET).remove(paths);
        if (removeError) console.warn('Could not remove the files:', removeError);
      }
      onCostumeUpdate(category, null);

      // รีเซ็ตฟอร์ม
      setCostumeName('');
      setPosition('');
      setUploaderName('');
      setDescription('');
      setFile(null);
      setPreview(null);
      
      toast.success("ลบผลงานสำเร็จแล้ว! / Entry deleted successfully!");
    } catch (error) {
      console.error("Error deleting costume:", error);
      toast.error("ลบผลงานล้มเหลว / Failed to delete.");
    } finally {
      setIsDeleting(false);
    }
  };

  const timeMessage = getTimeMessage();
  const isFormDisabled = uploadStatus !== 'during';

  return (
    <div className="max-w-2xl mx-auto bg-black/50 backdrop-blur-md p-8 rounded-2xl border border-purple-500/50 shadow-lg shadow-purple-500/20">
      <h2 className="font-display text-5xl text-center text-orange-500 mb-6">
        {existingCostume ? 'Edit Your Masterpiece' : 'Unveil Your Entry'}
      </h2>
      
      {/* Time Status Banner */}
      <div className={`mb-6 p-4 rounded-lg border ${
        timeMessage.type === 'info' 
          ? 'bg-orange-500/15 border-orange-500/40' 
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

      {/* Category */}
      <div className="mb-6">
        <p className="block text-yellow-400 font-bold mb-2">Category *</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {CATEGORIES.map((c) => {
            const hasEntry = existingCostumes.some((e) => e.category === c.id);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategory(c.id)}
                disabled={isUploading || isDeleting}
                className={`p-3 rounded-lg border text-left transition-all ${
                  category === c.id
                    ? 'border-orange-500 bg-orange-500/20'
                    : 'border-purple-600 bg-purple-900/40 hover:border-orange-400'
                }`}
              >
                <span className="text-2xl">{c.emoji}</span>
                <span className="block font-semibold text-sm">{c.label}</span>
                <span className="block text-xs text-gray-400">{c.labelTh}</span>
                {hasEntry && <span className="block text-xs text-green-400 mt-1">✓ Submitted</span>}
              </button>
            );
          })}
        </div>
        <p className="text-sm text-gray-300 mt-2">{categoryInfo.description}</p>
        {categoryInfo.hint && (
          <p className="text-sm text-yellow-300 mt-2 p-2 rounded bg-yellow-500/10 border border-yellow-500/30">{categoryInfo.hint}</p>
        )}
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
              {/* Always rendered so "Change" works when editing an entry that already has a file */}
              <input
                id="costume-file"
                name="costume-file"
                type="file"
                className="sr-only"
                onChange={handleFileChange}
                accept="image/*,video/*"
                disabled={isFormDisabled}
              />
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
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center md:opacity-0 md:group-hover:opacity-100 transition-opacity">
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
                    </label>
                    <p className="pl-1">or drag and drop</p>
                  </div>
                  <p className="text-xs text-gray-500">Photos (auto-resized) up to 50MB · Videos up to {MAX_VIDEO_MB}MB</p>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Entry name */}
        <div className="mb-4">
          <label htmlFor="costumeName" className="block text-yellow-400 font-bold mb-2">
            {categoryInfo.entryName} *
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