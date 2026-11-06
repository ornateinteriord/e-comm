import React, { useRef, useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  IconButton,
  CircularProgress,
  Alert,
  Chip,
  Stack,
} from '@mui/material';
import {
  CloudUpload as CloudUploadIcon,
  Close as CloseIcon,
  Star as StarIcon,
  Add as AddIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';
import api from '../api/client';

export interface ProductImageItem {
  id: string;
  url: string;
  name?: string;
  alt?: string;
  order: number;
}

interface ProductImageUploaderProps {
  images: ProductImageItem[];
  onChange: (images: ProductImageItem[]) => void;
  uploadEndpoint?: string;
  singleUploadEndpoint?: string;
  onTitleSuggest?: (title: string) => void;
  maxFiles?: number;
}

export const ProductImageUploader: React.FC<ProductImageUploaderProps> = ({
  images,
  onChange,
  uploadEndpoint = '/store/products/upload-images',
  singleUploadEndpoint = '/store/products/upload-image',
  onTitleSuggest,
  maxFiles = 15,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgressText, setUploadProgressText] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const processAndUploadFiles = async (fileList: FileList | File[]) => {
    const rawFiles = Array.from(fileList);
    if (rawFiles.length === 0) return;

    // Filter valid image files
    const validFiles = rawFiles.filter((file) => file.type.startsWith('image/'));
    if (validFiles.length === 0) {
      setErrorMessage('Please select valid image files (PNG, JPG, WEBP, GIF).');
      return;
    }

    // Check size limit: 15MB each
    const oversized = validFiles.find((file) => file.size > 15 * 1024 * 1024);
    if (oversized) {
      setErrorMessage(`File "${oversized.name}" exceeds the 15MB size limit.`);
      return;
    }

    if (images.length + validFiles.length > maxFiles) {
      setErrorMessage(`You can upload a maximum of ${maxFiles} images per product.`);
      return;
    }

    setErrorMessage(null);
    setIsUploading(true);
    setUploadProgressText(
      validFiles.length === 1
        ? 'Uploading image to ImageKit CDN...'
        : `Uploading ${validFiles.length} images to ImageKit CDN...`,
    );

    try {
      let uploadedItems: ProductImageItem[] = [];

      // Attempt batch upload first
      try {
        const formData = new FormData();
        validFiles.forEach((file) => {
          formData.append('images', file);
        });

        const res = await api.post(uploadEndpoint, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });

        if (res.data?.success && Array.isArray(res.data.data)) {
          uploadedItems = res.data.data.map((item: any, idx: number) => ({
            id: item.id || `img_${Date.now()}_${idx}`,
            url: item.url,
            name: item.name || item.title || '',
            alt: item.title || item.name || '',
            order: images.length + idx,
          }));

          if (onTitleSuggest && images.length === 0 && res.data.data[0]?.title) {
            onTitleSuggest(res.data.data[0].title);
          }
        }
      } catch {
        // Fallback to sequential/concurrent single image upload endpoint
        const singleUploadResults = await Promise.all(
          validFiles.map(async (file, idx) => {
            const singleForm = new FormData();
            singleForm.append('image', file);
            const singleRes = await api.post(singleUploadEndpoint, singleForm, {
              headers: { 'Content-Type': 'multipart/form-data' },
            });
            const d = singleRes.data?.data;
            return {
              id: d?.id || `img_${Date.now()}_${idx}`,
              url: d?.url || '',
              name: d?.name || file.name,
              alt: d?.title || file.name,
              order: images.length + idx,
            };
          }),
        );
        uploadedItems = singleUploadResults.filter((item) => Boolean(item.url));

        if (onTitleSuggest && images.length === 0 && uploadedItems[0]?.alt) {
          const cleanTitle = uploadedItems[0].alt.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ').trim();
          onTitleSuggest(cleanTitle);
        }
      }

      if (uploadedItems.length > 0) {
        const combined = [...images, ...uploadedItems];
        // Ensure index 0 has order: 0
        const reindexed = combined.map((img, idx) => ({ ...img, order: idx }));
        onChange(reindexed);
      }
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || err.message || 'Failed to upload images to ImageKit.';
      setErrorMessage(msg);
    } finally {
      setIsUploading(false);
      setUploadProgressText('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemove = (indexToRemove: number) => {
    const nextList = images.filter((_, idx) => idx !== indexToRemove);
    const reindexed = nextList.map((img, idx) => ({ ...img, order: idx }));
    onChange(reindexed);
  };

  const handleSetCover = (indexToCover: number) => {
    if (indexToCover === 0) return;
    const target = images[indexToCover];
    const remaining = images.filter((_, idx) => idx !== indexToCover);
    const reordered = [target, ...remaining].map((img, idx) => ({ ...img, order: idx }));
    onChange(reordered);
  };

  return (
    <Box>
      {/* Hidden File Input supporting multiple file selection */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => {
          if (e.target.files) {
            processAndUploadFiles(e.target.files);
          }
        }}
      />

      {errorMessage && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: '8px' }} onClose={() => setErrorMessage(null)}>
          {errorMessage}
        </Alert>
      )}

      {/* Loading state indicator */}
      {isUploading && (
        <Paper
          elevation={0}
          sx={{
            p: 3,
            mb: 2,
            borderRadius: '10px',
            border: '2px dashed #FF7900',
            bgcolor: 'rgba(255, 121, 0, 0.04)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1.5,
          }}
        >
          <CircularProgress size={32} sx={{ color: '#FF7900' }} />
          <Typography variant="subtitle2" fontWeight={800} color="#0f172a">
            {uploadProgressText}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Optimizing images and generating global ImageKit CDN URLs
          </Typography>
        </Paper>
      )}

      {images.length === 0 ? (
        /* Empty State Dropzone */
        <Paper
          elevation={0}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragging(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragging(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragging(false);
            if (e.dataTransfer.files) {
              processAndUploadFiles(e.dataTransfer.files);
            }
          }}
          sx={{
            p: 4,
            borderRadius: '10px',
            border: isDragging ? '2px dashed #FF7900' : '2px dashed #cbd5e1',
            bgcolor: isDragging ? 'rgba(255, 121, 0, 0.06)' : '#f8fafc',
            textAlign: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            '&:hover': {
              borderColor: '#FF7900',
              bgcolor: 'rgba(255, 121, 0, 0.03)',
            },
          }}
        >
          <Box
            sx={{
              width: 52,
              height: 52,
              borderRadius: '50%',
              bgcolor: 'rgba(255, 121, 0, 0.12)',
              color: '#FF7900',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mx: 'auto',
              mb: 1.5,
            }}
          >
            <CloudUploadIcon sx={{ fontSize: 28 }} />
          </Box>
          <Typography variant="subtitle2" fontWeight={800} color="#0f172a" sx={{ mb: 0.5 }}>
            Click to upload product images, or drag and drop here
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
            Supports PNG, JPG, WEBP, or GIF up to 15MB. You can select multiple images at once.
          </Typography>
          <Button
            variant="contained"
            size="small"
            startIcon={<CloudUploadIcon />}
            onClick={(e) => {
              e.stopPropagation();
              fileInputRef.current?.click();
            }}
            sx={{
              bgcolor: '#FF7900',
              color: '#FFFFFF',
              fontWeight: 800,
              textTransform: 'none',
              px: 3,
              py: 0.8,
              borderRadius: '6px',
              '&:hover': { bgcolor: '#E06A00' },
            }}
          >
            Select Image Files
          </Button>
        </Paper>
      ) : (
        /* Populated State: Gallery Grid with Card Cover Designation & Cross Removal */
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
            <Box>
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="caption" fontWeight={800} color="#334155" sx={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Uploaded Gallery ({images.length} {images.length === 1 ? 'image' : 'images'})
                </Typography>
                <Chip
                  icon={<CheckCircleIcon sx={{ fontSize: 13, color: '#16a34a !important' }} />}
                  label="ImageKit Hosted"
                  size="small"
                  sx={{
                    fontWeight: 800,
                    fontSize: 10,
                    bgcolor: '#dcfce7',
                    color: '#16a34a',
                    height: 20,
                  }}
                />
              </Stack>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
                Click &quot;Set as Card Image&quot; to pick which photo appears on product cards. Click the ✕ icon to delete.
              </Typography>
            </Box>

            <Button
              size="small"
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={() => fileInputRef.current?.click()}
              sx={{
                textTransform: 'none',
                fontWeight: 700,
                fontSize: '0.78rem',
                borderColor: '#cbd5e1',
                color: '#1e293b',
                borderRadius: '6px',
                '&:hover': { borderColor: '#FF7900', color: '#FF7900', bgcolor: 'rgba(255, 121, 0, 0.04)' },
              }}
            >
              Add More Images
            </Button>
          </Box>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: 'repeat(2, 1fr)',
                sm: 'repeat(3, 1fr)',
                md: 'repeat(4, 1fr)',
              },
              gap: 2,
            }}
          >
            {images.map((img, idx) => {
              const isCover = idx === 0;
              return (
                <Paper
                  key={img.id || `${img.url}_${idx}`}
                  elevation={0}
                  sx={{
                    position: 'relative',
                    borderRadius: '10px',
                    overflow: 'hidden',
                    border: isCover ? '2px solid #FF7900' : '1px solid #e2e8f0',
                    bgcolor: isCover ? '#fffaf5' : '#ffffff',
                    transition: 'all 0.2s ease',
                    boxShadow: isCover ? '0 4px 14px rgba(255, 121, 0, 0.18)' : '0 1px 3px rgba(0,0,0,0.04)',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  {/* Top-Left Badge: Cover Chip or Index */}
                  {isCover ? (
                    <Chip
                      icon={<StarIcon sx={{ fontSize: '13px !important', color: '#FFFFFF !important' }} />}
                      label="Card Cover"
                      size="small"
                      sx={{
                        position: 'absolute',
                        top: 8,
                        left: 8,
                        height: 22,
                        fontSize: '0.68rem',
                        fontWeight: 800,
                        bgcolor: '#FF7900',
                        color: '#FFFFFF',
                        zIndex: 2,
                        boxShadow: '0 2px 6px rgba(255, 121, 0, 0.35)',
                      }}
                    />
                  ) : (
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 8,
                        left: 8,
                        height: 22,
                        minWidth: 22,
                        px: 0.75,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '4px',
                        bgcolor: 'rgba(15, 23, 42, 0.65)',
                        color: '#FFFFFF',
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        zIndex: 2,
                        backdropFilter: 'blur(4px)',
                      }}
                    >
                      #{idx + 1}
                    </Box>
                  )}

                  {/* Top-Right Cross Icon to Remove Image */}
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemove(idx);
                    }}
                    title="Remove Image"
                    sx={{
                      position: 'absolute',
                      top: 6,
                      right: 6,
                      width: 26,
                      height: 26,
                      bgcolor: 'rgba(15, 23, 42, 0.7)',
                      color: '#FFFFFF',
                      backdropFilter: 'blur(4px)',
                      transition: 'all 0.15s ease',
                      zIndex: 2,
                      '&:hover': {
                        bgcolor: '#EF4444',
                        color: '#FFFFFF',
                        transform: 'scale(1.08)',
                      },
                    }}
                  >
                    <CloseIcon sx={{ fontSize: 16 }} />
                  </IconButton>

                  {/* Thumbnail Image */}
                  <Box
                    sx={{
                      width: '100%',
                      height: 130,
                      bgcolor: '#f1f5f9',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                    }}
                  >
                    <Box
                      component="img"
                      src={img.url}
                      alt={img.name || img.alt || `Product image ${idx + 1}`}
                      sx={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        transition: 'transform 0.3s ease',
                        '&:hover': {
                          transform: 'scale(1.04)',
                        },
                      }}
                    />
                  </Box>

                  {/* Card Bottom: Cover Actions */}
                  <Box
                    sx={{
                      p: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      bgcolor: isCover ? '#FFF7ED' : '#FAFAFA',
                      borderTop: '1px solid',
                      borderColor: isCover ? 'rgba(255, 121, 0, 0.2)' : '#F1F5F9',
                    }}
                  >
                    {isCover ? (
                      <Stack direction="row" spacing={0.5} alignItems="center">
                        <StarIcon sx={{ fontSize: 14, color: '#FF7900' }} />
                        <Typography variant="caption" fontWeight={800} sx={{ color: '#FF7900', fontSize: '0.72rem' }}>
                          Primary Cover
                        </Typography>
                      </Stack>
                    ) : (
                      <Button
                        size="small"
                        onClick={() => handleSetCover(idx)}
                        startIcon={<StarIcon sx={{ fontSize: '13px !important' }} />}
                        sx={{
                          textTransform: 'none',
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          py: 0.25,
                          px: 1,
                          color: '#475569',
                          borderRadius: '4px',
                          '&:hover': {
                            color: '#FF7900',
                            bgcolor: 'rgba(255, 121, 0, 0.08)',
                          },
                        }}
                      >
                        Set as Card Image
                      </Button>
                    )}
                  </Box>
                </Paper>
              );
            })}

            {/* Quick Add More Tile in Grid */}
            <Paper
              elevation={0}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (e.dataTransfer.files) {
                  processAndUploadFiles(e.dataTransfer.files);
                }
              }}
              sx={{
                minHeight: 170,
                borderRadius: '10px',
                border: '2px dashed #cbd5e1',
                bgcolor: '#f8fafc',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                p: 2,
                transition: 'all 0.2s ease',
                '&:hover': {
                  borderColor: '#FF7900',
                  bgcolor: 'rgba(255, 121, 0, 0.03)',
                  '& .add-icon-box': {
                    bgcolor: '#FF7900',
                    color: '#FFFFFF',
                    transform: 'scale(1.08)',
                  },
                  '& .add-text': {
                    color: '#FF7900',
                  },
                },
              }}
            >
              <Box
                className="add-icon-box"
                sx={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  bgcolor: '#E2E8F0',
                  color: '#475569',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mb: 1,
                  transition: 'all 0.2s ease',
                }}
              >
                <AddIcon fontSize="small" />
              </Box>
              <Typography className="add-text" variant="caption" fontWeight={800} color="#475569" sx={{ transition: 'color 0.2s' }}>
                + Add Image
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem', mt: 0.25 }}>
                PNG, JPG, WEBP
              </Typography>
            </Paper>
          </Box>
        </Box>
      )}
    </Box>
  );
};

