import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { AuthManager } from "@/lib/auth";
import { Upload, Trash2, Edit, Camera, GripVertical, Download } from "lucide-react";
import JSZip from "jszip";

interface Photo {
  id: string;
  entityType: string;
  entityId: string;
  urlOrPath: string;
  caption: string;
  sortOrder: number;
}

interface PhotoManagementProps {
  entityType: 'COMPANY' | 'PARK' | 'LOT';
  entityId: string;
  entityName: string;
}

export function PhotoManagement({ entityType, entityId, entityName }: PhotoManagementProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [captions, setCaptions] = useState<{[fileName: string]: string}>({});
  const [editingPhoto, setEditingPhoto] = useState<Photo | null>(null);
  const [editCaption, setEditCaption] = useState("");
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [draggedPhoto, setDraggedPhoto] = useState<Photo | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<Set<string>>(new Set());
  const [isDragging, setIsDragging] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [fileInputKey, setFileInputKey] = useState(0);

  const endpointBase = entityType === 'COMPANY' ? 'companies' : entityType === 'PARK' ? 'parks' : 'lots';

  // Reset upload state when dialog opens
  useEffect(() => {
    if (isUploadOpen) {
      setSelectedFiles([]);
      setCaptions({});
      setFileInputKey(prev => prev + 1); // Force file input to remount
    }
  }, [isUploadOpen]);

  // Fetch photos
  const { data: photos = [], isLoading } = useQuery<Photo[]>({
    queryKey: [`/api/${endpointBase}`, entityId, 'photos'],
  });

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async ({ files, captions: fileCaptions }: { files: File[]; captions: {[fileName: string]: string} }) => {
      const formData = new FormData();
      
      // Append each file
      files.forEach(file => {
        formData.append('photos', file);
      });
      
      // Append captions as a JSON string
      const captionArray = files.map(file => fileCaptions[file.name] || '');
      formData.append('captions', JSON.stringify(captionArray));

      // Debug: Log FormData contents
      console.log('FormData entries:');
      for (const [key, value] of Array.from(formData.entries())) {
        console.log(`${key}:`, value);
      }
      
      // Debug: Log the specific captions being sent
      console.log('Files being uploaded:', files.map(f => f.name));
      console.log('Captions object:', fileCaptions);
      console.log('Caption array being sent:', captionArray);

      const response = await fetch(`/api/${endpointBase}/${entityId}/photos`, {
        method: 'POST',
        body: formData,
        headers: {
          ...AuthManager.getAuthHeaders()
        },
        credentials: 'include'
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Upload failed:', response.status, errorText);
        throw new Error(`Upload failed: ${response.status} ${errorText}`);
      }

      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [`/api/${endpointBase}`, entityId, 'photos'] });
      setSelectedFiles([]);
      setCaptions({});
      setIsUploadOpen(false);
      toast({
        title: "Success",
        description: `${Array.isArray(data) ? data.length : 1} photo(s) uploaded successfully`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to upload photos",
        variant: "destructive",
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (photoId: string) => {
      console.log('Deleting photo:', photoId);
      const response = await apiRequest("DELETE", `/api/photos/${photoId}`);
      console.log('Delete response:', response.status);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/${endpointBase}`, entityId, 'photos'] });
      toast({
        title: "Success",
        description: "Photo deleted successfully",
      });
    },
    onError: (error: any) => {
      console.error('Photo deletion error:', error);
      const errorMessage = error?.message || error?.response?.data?.message || "Failed to delete photo";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  // Update caption mutation
  const updateCaptionMutation = useMutation({
    mutationFn: async ({ photoId, caption }: { photoId: string; caption: string }) => {
      console.log('Updating photo caption:', { photoId, caption });
      return apiRequest("PATCH", `/api/photos/${photoId}`, { caption });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/${endpointBase}`, entityId, 'photos'] });
      setEditingPhoto(null);
      setEditCaption("");
      toast({
        title: "Success",
        description: "Photo caption updated successfully",
      });
    },
    onError: (error: any) => {
      console.error('Photo caption update error:', error);
      toast({
        title: "Error",
        description: error?.message || "Failed to update photo caption",
        variant: "destructive",
      });
    },
  });

  // Reorder mutation
  const reorderMutation = useMutation({
    mutationFn: async (photoOrders: Array<{id: string, sortOrder: number}>) => {
      console.log('Reordering photos:', { entityType, entityId, photoOrders });
      return apiRequest("PATCH", "/api/photos/reorder", {
        entityType,
        entityId,
        photoOrders
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/${endpointBase}`, entityId, 'photos'] });
      toast({
        title: "Success",
        description: "Photos reordered successfully",
      });
    },
    onError: (error: any) => {
      console.error('Reorder photos error:', error);
      toast({
        title: "Error",
        description: error?.message || "Failed to reorder photos",
        variant: "destructive",
      });
    },
  });

  // Shared validation function for file selection
  const validateAndSetFiles = (files: File[]) => {
    console.log('validateAndSetFiles called with:', files.length, 'files');
    console.log('Files received:', files.map(f => ({ name: f.name, size: f.size, type: f.type })));
    
    // Check if user is trying to upload more than 20 photos
    if (files.length > 20) {
      toast({
        title: "Error",
        description: `You can only upload up to 20 photos at a time. You selected ${files.length} photos.`,
        variant: "destructive",
      });
      return;
    }
    
    const validFiles: File[] = [];
    const invalidFiles: Array<{name: string, reason: string}> = [];
    
    for (const file of files) {
      console.log('Validating file:', file.name, { size: file.size, type: file.type });
      
      if (file.size > 10 * 1024 * 1024) {
        console.log('File rejected - too large:', file.name);
        invalidFiles.push({ name: file.name, reason: 'too large (>10MB)' });
        toast({
          title: "Error",
          description: `${file.name} is larger than 10MB`,
          variant: "destructive",
        });
        continue;
      }
      if (!file.type.startsWith('image/')) {
        console.log('File rejected - not an image:', file.name, file.type);
        invalidFiles.push({ name: file.name, reason: `not an image (${file.type})` });
        toast({
          title: "Error",
          description: `${file.name} is not an image file`,
          variant: "destructive",
        });
        continue;
      }
      console.log('File accepted:', file.name);
      validFiles.push(file);
    }
    
    console.log('Valid files:', validFiles.length);
    console.log('Invalid files:', invalidFiles);
    
    if (validFiles.length > 0) {
      setSelectedFiles(validFiles);
      // Initialize captions for new files
      const newCaptions: {[fileName: string]: string} = {};
      validFiles.forEach(file => {
        if (!captions[file.name]) {
          newCaptions[file.name] = '';
        }
      });
      setCaptions(prev => ({ ...prev, ...newCaptions }));
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    validateAndSetFiles(files);
    // Reset the input so the same file can be selected again
    e.target.value = '';
  };

  const handleUpload = () => {
    if (selectedFiles.length === 0) return;
    
    // Debug: Log what we're sending
    console.log('Uploading files:', selectedFiles.map(f => f.name));
    console.log('Captions being sent:', captions);
    console.log('Caption array:', selectedFiles.map(file => captions[file.name] || ''));
    
    uploadMutation.mutate({ files: selectedFiles, captions });
  };
  
  const updateCaption = (fileName: string, caption: string) => {
    setCaptions(prev => ({ ...prev, [fileName]: caption }));
  };
  
  const removeFile = (fileName: string) => {
    setSelectedFiles(prev => prev.filter(file => file.name !== fileName));
    setCaptions(prev => {
      const newCaptions = { ...prev };
      delete newCaptions[fileName];
      return newCaptions;
    });
  };

  const handleDelete = (photoId: string) => {
    if (confirm("Are you sure you want to delete this photo?")) {
      deleteMutation.mutate(photoId);
    }
  };

  // Download handlers
  const downloadSinglePhoto = async (photo: Photo) => {
    try {
      // Use the dedicated download endpoint
      const response = await fetch(`/api/photos/${photo.id}/download`, {
        credentials: 'include',
        headers: {
          ...AuthManager.getAuthHeaders()
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch photo: ${response.status}`);
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const extension = photo.urlOrPath.split('.').pop()?.split('?')[0] || 'jpg';
      const sanitizedCaption = photo.caption?.replace(/[^a-zA-Z0-9-_]/g, '_') || photo.id;
      const fileName = photo.caption 
        ? `${entityName}-${sanitizedCaption}.${extension}`
        : `${entityName}-${photo.id}.${extension}`;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      toast({
        title: "Success",
        description: "Photo downloaded successfully",
      });
    } catch (error) {
      console.error('Download error:', error);
      toast({
        title: "Error",
        description: `Failed to download photo: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      });
    }
  };

  const downloadMultiplePhotos = async (photosToDownload: Photo[]) => {
    if (photosToDownload.length === 0) return;
    
    setIsDownloading(true);
    try {
      const zip = new JSZip();
      const folder = zip.folder(entityName);
      
      if (!folder) {
        throw new Error('Failed to create ZIP folder');
      }
      
      // Track successful downloads
      let successCount = 0;
      
      // Download all photos and add them to the zip
      for (let i = 0; i < photosToDownload.length; i++) {
        const photo = photosToDownload[i];
        try {
          console.log(`Downloading photo ${i + 1}/${photosToDownload.length}:`, photo.id);
          
          // Use the dedicated download endpoint
          const response = await fetch(`/api/photos/${photo.id}/download`, {
            credentials: 'include',
            headers: {
              ...AuthManager.getAuthHeaders()
            }
          });
          
          if (!response.ok) {
            console.error(`Failed to fetch photo ${photo.id}: ${response.status}`);
            continue;
          }
          
          const blob = await response.blob();
          
          if (blob.size === 0) {
            console.error(`Photo ${photo.id} has zero size`);
            continue;
          }
          
          const extension = photo.urlOrPath.split('.').pop()?.split('?')[0] || 'jpg';
          // Sanitize caption for filename (remove special characters)
          const sanitizedCaption = photo.caption?.replace(/[^a-zA-Z0-9-_]/g, '_') || 'photo';
          const fileName = photo.caption 
            ? `${i + 1}-${sanitizedCaption}.${extension}`
            : `${i + 1}-photo.${extension}`;
          
          folder.file(fileName, blob);
          successCount++;
          console.log(`Added photo to ZIP: ${fileName} (${blob.size} bytes)`);
        } catch (error) {
          console.error(`Failed to download photo ${photo.id}:`, error);
        }
      }
      
      if (successCount === 0) {
        throw new Error('No photos could be downloaded');
      }
      
      // Generate and download the zip
      console.log('Generating ZIP file with', successCount, 'photos...');
      const zipBlob = await zip.generateAsync({ 
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: {
          level: 6
        }
      });
      
      console.log('ZIP generated, size:', zipBlob.size);
      
      const url = window.URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${entityName.replace(/[^a-zA-Z0-9-_]/g, '_')}-photos.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      toast({
        title: "Success",
        description: `Downloaded ${successCount} of ${photosToDownload.length} photo(s) as ZIP`,
      });
    } catch (error) {
      console.error('Download error:', error);
      toast({
        title: "Error",
        description: `Failed to download photos: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      });
    } finally {
      setIsDownloading(false);
    }
  };

  const togglePhotoSelection = (photoId: string) => {
    setSelectedPhotoIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(photoId)) {
        newSet.delete(photoId);
      } else {
        newSet.add(photoId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedPhotoIds.size === photos.length) {
      setSelectedPhotoIds(new Set());
    } else {
      setSelectedPhotoIds(new Set(photos.map(p => p.id)));
    }
  };

  const handleDownloadSelected = () => {
    const selectedPhotos = photos.filter(p => selectedPhotoIds.has(p.id));
    downloadMultiplePhotos(selectedPhotos);
  };

  const handleDownloadAll = () => {
    downloadMultiplePhotos(photos);
  };

  // Drag and drop handlers for file upload
  const handleFileDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('Drag enter - items:', e.dataTransfer.items?.length, 'types:', Array.from(e.dataTransfer.types));
    
    // Log each item's details during drag enter
    if (e.dataTransfer.items) {
      for (let i = 0; i < e.dataTransfer.items.length; i++) {
        const item = e.dataTransfer.items[i];
        console.log(`DragEnter - Item ${i}:`, {
          kind: item.kind,
          type: item.type
        });
      }
    }
  };

  const handleFileDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Set the dropEffect to indicate this is a copy operation
    e.dataTransfer.dropEffect = 'copy';
    setIsDragging(true);
  };

  const handleFileDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set isDragging to false if we're actually leaving the drop zone
    // and not just entering a child element
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    
    if (x <= rect.left || x >= rect.right || y <= rect.top || y >= rect.bottom) {
      setIsDragging(false);
    }
  };

  const handleFileDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    // Debug: Check what we're getting from the drop event
    console.log('Drop event dataTransfer:', e.dataTransfer);
    console.log('dataTransfer.files:', e.dataTransfer.files);
    console.log('dataTransfer.items:', e.dataTransfer.items);
    console.log('Number of files:', e.dataTransfer.files.length);
    console.log('Number of items:', e.dataTransfer.items?.length);
    
    // Use dataTransfer.items API for better compatibility with Windows File Explorer
    // This handles multiple file drops more reliably
    const files: File[] = [];
    
    if (e.dataTransfer.items) {
      // Use DataTransferItemList interface
      const items = Array.from(e.dataTransfer.items);
      console.log('Processing items:', items.length);
      
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        console.log('Item', i, ':', { kind: item.kind, type: item.type });
        
        // Only process file items
        if (item.kind === 'file') {
          const file = item.getAsFile();
          if (file) {
            console.log('Got file from item:', file.name);
            files.push(file);
          }
        }
      }
    } else {
      // Fallback to dataTransfer.files
      console.log('Falling back to dataTransfer.files');
      files.push(...Array.from(e.dataTransfer.files));
    }
    
    console.log('Files array after processing:', files.length, files.map(f => ({ name: f.name, size: f.size, type: f.type })));
    
    validateAndSetFiles(files);
  };

  // Drag and drop handlers for photo reordering
  const handleDragStart = (e: React.DragEvent, photo: Photo) => {
    setDraggedPhoto(photo);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', photo.id);
    (e.currentTarget as HTMLElement).style.opacity = '0.5';
  };

  const handleDragEnd = (e: React.DragEvent) => {
    (e.currentTarget as HTMLElement).style.opacity = '1';
    setDraggedPhoto(null);
    setDragOverIndex(null);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    setDragOverIndex(null);
    
    if (!draggedPhoto) {
      console.log('No dragged photo');
      return;
    }

    const dragIndex = photos.findIndex(p => p.id === draggedPhoto.id);
    if (dragIndex === dropIndex) {
      console.log('Same position, no reorder needed');
      return;
    }

    // Create new order for photos
    const reorderedPhotos = [...photos];
    const [draggedItem] = reorderedPhotos.splice(dragIndex, 1);
    reorderedPhotos.splice(dropIndex, 0, draggedItem);

    // Generate new sort orders
    const photoOrders = reorderedPhotos.map((photo, index) => ({
      id: photo.id,
      sortOrder: index + 1
    }));

    console.log('About to call reorder mutation with:', {
      entityType,
      entityId,
      photoOrders,
      photoCount: photoOrders.length
    });

    // Call reorder mutation
    reorderMutation.mutate(photoOrders);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Camera className="w-5 h-5" />
            Photos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse text-center py-8">Loading photos...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5" />
            Photos ({photos.length})
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {photos.length > 0 && (
              <>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={toggleSelectAll}
                  data-testid="button-toggle-select-all"
                >
                  {selectedPhotoIds.size === photos.length ? 'Deselect All' : 'Select All'}
                </Button>
                {selectedPhotoIds.size > 0 && (
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={handleDownloadSelected}
                    disabled={isDownloading}
                    data-testid="button-download-selected"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download Selected ({selectedPhotoIds.size})
                  </Button>
                )}
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={handleDownloadAll}
                  disabled={isDownloading}
                  data-testid="button-download-all"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download All
                </Button>
              </>
            )}
            <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
              <DialogTrigger asChild>
                <Button size="sm" data-testid="button-add-photo">
                  <Upload className="w-4 h-4 mr-2" />
                  Add Photo
                </Button>
              </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Upload Photo for {entityName}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {/* Drag and Drop Zone */}
                <div
                  onDragEnter={handleFileDragEnter}
                  onDragOver={handleFileDragOver}
                  onDragLeave={handleFileDragLeave}
                  onDrop={handleFileDrop}
                  className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                    isDragging 
                      ? 'border-primary bg-primary/5' 
                      : 'border-muted-foreground/25 hover:border-muted-foreground/50'
                  }`}
                >
                  <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-sm font-medium mb-1">
                    Drag and drop images here
                  </p>
                  <p className="text-xs text-muted-foreground">
                    or use the button below
                  </p>
                </div>
                
                <div>
                  <Label htmlFor="photo-files">Select Images</Label>
                  <Input
                    key={fileInputKey}
                    id="photo-files"
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleFileSelect}
                    data-testid="input-photo-files"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    You can select multiple images at once (max 20, max 10MB each)
                  </p>
                </div>
                {selectedFiles.length > 0 && (
                  <div className="space-y-3 max-h-60 overflow-y-auto">
                    <h4 className="font-semibold text-sm">Selected Files ({selectedFiles.length})</h4>
                    {selectedFiles.map((file, index) => (
                      <div key={file.name} className="flex items-start gap-2 p-3 border rounded-lg">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate" title={file.name}>
                            {file.name.length > 25 ? `${file.name.substring(0, 22)}...` : file.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {(file.size / 1024 / 1024).toFixed(1)}MB
                          </p>
                          <Input
                            placeholder="Enter caption (optional)"
                            value={captions[file.name] || ''}
                            onChange={(e) => updateCaption(file.name, e.target.value)}
                            className="mt-2"
                            data-testid={`input-caption-${file.name}`}
                          />
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => removeFile(file.name)}
                          data-testid={`button-remove-${file.name}`}
                          className="flex-shrink-0"
                        >
                          ×
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex justify-end space-x-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setIsUploadOpen(false)}
                    data-testid="button-cancel-upload"
                  >
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleUpload}
                    disabled={selectedFiles.length === 0 || uploadMutation.isPending}
                    data-testid="button-upload-photos"
                  >
                    {uploadMutation.isPending 
                      ? `Uploading ${selectedFiles.length} photo(s)...` 
                      : `Upload ${selectedFiles.length} photo(s)`}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {photos.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Camera className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No photos uploaded yet</p>
            <p className="text-sm">Click "Add Photo" to upload the first photo</p>
          </div>
        ) : (
          <div className="space-y-4">
            {photos.length > 1 && (
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                <GripVertical className="w-4 h-4" />
                Drag and drop photos to reorder them
              </div>
            )}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {photos.map((photo, index) => (
                <div 
                  key={photo.id} 
                  className={`relative group cursor-move transition-all duration-200 ${
                    dragOverIndex === index ? 'scale-105 ring-2 ring-blue-500' : ''
                  } ${draggedPhoto?.id === photo.id ? 'opacity-50' : ''}`}
                  draggable
                  onDragStart={(e) => handleDragStart(e, photo)}
                  onDragEnd={handleDragEnd}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, index)}
                  data-testid={`photo-item-${photo.id}`}
                >
                  {/* Checkbox for selection */}
                  <div className="absolute top-2 left-2 z-20 bg-white rounded p-1">
                    <Checkbox
                      checked={selectedPhotoIds.has(photo.id)}
                      onCheckedChange={() => togglePhotoSelection(photo.id)}
                      onClick={(e) => e.stopPropagation()}
                      data-testid={`checkbox-photo-${photo.id}`}
                    />
                  </div>
                  
                  {/* Drag handle */}
                  <div className="absolute top-2 right-2 z-10 bg-white/80 rounded p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <GripVertical className="w-4 h-4 text-gray-600" />
                  </div>
                  <div className="w-full h-32 bg-gray-100 rounded-lg flex items-center justify-center relative">
                    <img
                      src={photo.urlOrPath}
                      alt={photo.caption || 'Photo'}
                      className="w-full h-full object-cover rounded-lg"
                      data-testid={`img-photo-${photo.id}`}
                      onError={(e) => {
                        console.error('Failed to load image:', photo.urlOrPath);
                        e.currentTarget.style.display = 'none';
                        // Show fallback content
                        const fallback = e.currentTarget.parentElement?.querySelector('.fallback-content');
                        if (fallback) {
                          (fallback as HTMLElement).style.display = 'flex';
                        }
                      }}
                    />
                    <div className="fallback-content absolute inset-0 bg-gray-100 rounded-lg flex flex-col items-center justify-center text-gray-500" style={{ display: 'none' }}>
                      <Camera className="w-8 h-8 mb-2" />
                      <span className="text-sm">Photo</span>
                    </div>
                  </div>
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center space-x-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => downloadSinglePhoto(photo)}
                      data-testid={`button-download-photo-${photo.id}`}
                      title="Download photo"
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setEditingPhoto(photo);
                        setEditCaption(photo.caption);
                      }}
                      data-testid={`button-edit-photo-${photo.id}`}
                      title="Edit caption"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDelete(photo.id)}
                      data-testid={`button-delete-photo-${photo.id}`}
                      title="Delete photo"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                  {photo.caption && (
                    <p className="text-xs text-muted-foreground mt-1 truncate" title={photo.caption}>
                      {photo.caption}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Edit Caption Dialog */}
        <Dialog open={!!editingPhoto} onOpenChange={(open) => !open && setEditingPhoto(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Photo Caption</DialogTitle>
            </DialogHeader>
            {editingPhoto && (
              <div className="space-y-4">
                <div className="w-full h-48 bg-gray-100 rounded-lg flex items-center justify-center relative">
                  <img
                    src={editingPhoto.urlOrPath}
                    alt="Photo preview"
                    className="w-full h-full object-cover rounded-lg"
                    onError={(e) => {
                      console.error('Failed to load image in edit dialog:', editingPhoto.urlOrPath);
                      e.currentTarget.style.display = 'none';
                      const fallback = e.currentTarget.parentElement?.querySelector('.fallback-content');
                      if (fallback) {
                        (fallback as HTMLElement).style.display = 'flex';
                      }
                    }}
                  />
                  <div className="fallback-content absolute inset-0 bg-gray-100 rounded-lg flex flex-col items-center justify-center text-gray-500" style={{ display: 'none' }}>
                    <Camera className="w-12 h-12 mb-2" />
                    <span className="text-sm">Photo Preview</span>
                  </div>
                </div>
                <div>
                  <Label htmlFor="edit-caption">Caption</Label>
                  <Input
                    id="edit-caption"
                    value={editCaption}
                    onChange={(e) => setEditCaption(e.target.value)}
                    placeholder="Enter a caption for this photo"
                    data-testid="input-edit-caption"
                  />
                </div>
                <div className="flex justify-end space-x-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setEditingPhoto(null)}
                    data-testid="button-cancel-edit"
                  >
                    Cancel
                  </Button>
                  <Button 
                    onClick={() => {
                      if (editingPhoto) {
                        updateCaptionMutation.mutate({
                          photoId: editingPhoto.id,
                          caption: editCaption
                        });
                      }
                    }}
                    disabled={updateCaptionMutation.isPending}
                    data-testid="button-save-caption"
                  >
                    {updateCaptionMutation.isPending ? "Saving..." : "Save Caption"}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}