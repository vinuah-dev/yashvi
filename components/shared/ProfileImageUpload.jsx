"use client";

import { useState, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Camera, X, User, Loader2 } from "lucide-react";
import {
  compressMemberImage,
  validateMemberImage,
} from "@/lib/utils/memberImageUpload";

export default function ProfileImageUpload({ 
  currentImage, 
  onImageChange, 
  memberId,
  size = "lg", // sm, md, lg
  editable = true,
  showHint = true,
  align = "center",
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(currentImage);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const fileInputRef = useRef(null);

  const sizeClasses = {
    sm: "w-16 h-16 text-xl",
    md: "w-20 h-20 text-2xl",
    lg: "w-28 h-28 text-3xl",
  };

  const iconSizes = {
    sm: "w-4 h-4",
    md: "w-5 h-5",
    lg: "w-6 h-6",
  };

  const alignmentClass = align === "left" ? "items-start text-left" : "items-center text-center";

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);

    const validationError = validateMemberImage(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    let processedFile = file;
    try {
      processedFile = await compressMemberImage(file);
    } catch (err) {
      console.error("Compression failed", err);
      setError("Could not compress image. Please try another photo.");
      return;
    }

    // Show preview immediately
    const objectUrl = URL.createObjectURL(processedFile);
    setPreviewUrl(objectUrl);

    // Upload to Supabase Storage
    await uploadImage(processedFile);

    // Cleanup preview URL
    URL.revokeObjectURL(objectUrl);
  };

  const uploadImage = async (file) => {
    setUploading(true);
    setError(null);

    try {
      // Generate unique filename
      const fileExt = file.name.split(".").pop();
      const fileName = `${memberId}-${Date.now()}.${fileExt}`;
      const filePath = `profiles/${fileName}`;

      // Delete old image if exists
      if (currentImage) {
        const oldPath = currentImage.split("/").pop();
        if (oldPath) {
          await supabase.storage
            .from("member-images")
            .remove([`profiles/${oldPath}`]);
        }
      }

      // Upload new image
      const { data, error: uploadError } = await supabase.storage
        .from("member-images")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: true,
        });

      if (uploadError) {
        throw uploadError;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("member-images")
        .getPublicUrl(filePath);

      const publicUrl = urlData.publicUrl;
      setPreviewUrl(publicUrl);

      // Update member record with new image URL
      const { error: updateError } = await supabase
        .from("members")
        .update({ profile_image: publicUrl })
        .eq("id", memberId);

      if (updateError) {
        throw updateError;
      }

      // Notify parent component
      if (onImageChange) {
        onImageChange(publicUrl);
      }
    } catch (err) {
      console.error("Error uploading image:", err);
      setError("Failed to upload image. Please try again.");
      setPreviewUrl(currentImage); // Revert to original
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveImage = async () => {
    if (!previewUrl) return;

    setUploading(true);
    setError(null);

    try {
      // Extract filename from URL
      const urlParts = previewUrl.split("/");
      const fileName = urlParts[urlParts.length - 1];

      // Delete from storage
      await supabase.storage
        .from("member-images")
        .remove([`profiles/${fileName}`]);

      // Update member record
      await supabase
        .from("members")
        .update({ profile_image: null })
        .eq("id", memberId);

      setPreviewUrl(null);

      if (onImageChange) {
        onImageChange(null);
      }
    } catch (err) {
      console.error("Error removing image:", err);
      setError("Failed to remove image");
    } finally {
      setUploading(false);
    }
  };

  const triggerFileInput = () => {
    if (editable && !uploading) {
      fileInputRef.current?.click();
    }
  };

  const openImagePreview = () => {
    if (!previewUrl || uploading) return;
    setIsPreviewOpen(true);
  };

  const closeImagePreview = () => {
    setIsPreviewOpen(false);
  };

  return (
    <div className={`flex flex-col ${alignmentClass}`}>
      <div className="relative">
        {/* Profile Image */}
        <div
          onClick={openImagePreview}
          className={`${sizeClasses[size]} rounded-full overflow-hidden bg-gradient-to-br from-[#f0813d] to-[#f0813d] flex items-center justify-center text-white font-bold relative ${
            previewUrl && !uploading ? "cursor-pointer" : ""
          }`}
          role={previewUrl ? "button" : undefined}
          tabIndex={previewUrl && !uploading ? 0 : -1}
          onKeyDown={(event) => {
            if ((event.key === "Enter" || event.key === " ") && previewUrl && !uploading) {
              event.preventDefault();
              openImagePreview();
            }
          }}
        >
          {previewUrl ? (
            <img
              src={previewUrl}
              alt="Profile"
              className="w-full h-full object-cover"
            />
          ) : (
            <User className={iconSizes[size]} />
          )}

          {/* Uploading overlay */}
          {uploading && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-white animate-spin" />
            </div>
          )}
        </div>

        {/* Camera button */}
        {editable && !uploading && (
          <button
            type="button"
            onClick={triggerFileInput}
            aria-label="Change profile photo"
            className="absolute -bottom-1 -right-1 w-8 h-8 bg-white rounded-full shadow-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50 active:scale-95 transition-all"
          >
            <Camera className="w-4 h-4 text-gray-600" />
          </button>
        )}

        {/* Remove button */}
        {editable && previewUrl && !uploading && (
          <button
            type="button"
            onClick={handleRemoveImage}
            className="absolute -top-1 -right-1 w-6 h-6 bg-[#f0813d] rounded-full shadow-lg flex items-center justify-center hover:bg-[#f0813d] active:scale-95 transition-all"
          >
            <X className="w-3 h-3 text-white" />
          </button>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Upload hint */}
      {editable && showHint && (
        <p className={`text-xs text-gray-500 mt-2 ${align === "left" ? "text-left" : "text-center"}`}>
          {uploading ? "Uploading..." : "Tap camera to change photo"}
          <br />
          <span className="text-gray-400">Compressed under 100KB • JPG, PNG, WebP</span>
        </p>
      )}

      {/* Error message */}
      {error && (
        <p className={`text-xs text-[#f0813d] mt-2 ${align === "left" ? "text-left" : "text-center"}`}>{error}</p>
      )}

      {/* WhatsApp-style profile preview modal */}
      {isPreviewOpen && previewUrl && (
        <div
          className="fixed inset-0 z-[100] bg-black/85 flex items-center justify-center p-4"
          onClick={closeImagePreview}
        >
          <button
            type="button"
            onClick={closeImagePreview}
            aria-label="Close image preview"
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/50 border border-white/20 text-white flex items-center justify-center hover:bg-black/70 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div
            className="max-w-[92vw] max-h-[82vh]"
            onClick={(event) => event.stopPropagation()}
          >
            <img
              src={previewUrl}
              alt="Profile preview"
              className="max-w-full max-h-[82vh] object-contain rounded-xl shadow-2xl"
            />
          </div>
        </div>
      )}
    </div>
  );
}
