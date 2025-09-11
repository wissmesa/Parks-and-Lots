import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Upload, Trash2, Edit, Camera } from "lucide-react";

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

  const endpointBase = entityType === 'COMPANY' ? 'companies' : entityType === 'PARK' ? 'parks' : 'lots';

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
      
      // Append captions as an array in the same order as files
      const captionArray = files.map(file => fileCaptions[file.name] || '');
      captionArray.forEach(caption => {
        formData.append('captions', caption);
      });

      const response = await fetch(`/api/${endpointBase}/${entityId}/photos`, {
        method: 'POST',
        body: formData,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Upload failed');
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
      return apiRequest("DELETE", `/api/photos/${photoId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/${endpointBase}`, entityId, 'photos'] });
      toast({
        title: "Success",
        description: "Photo deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete photo",
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles: File[] = [];
    
    for (const file of files) {
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "Error",
          description: `${file.name} is larger than 10MB`,
          variant: "destructive",
        });
        continue;
      }
      if (!file.type.startsWith('image/')) {
        toast({
          title: "Error",
          description: `${file.name} is not an image file`,
          variant: "destructive",
        });
        continue;
      }
      validFiles.push(file);
    }
    
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

  const handleUpload = () => {
    if (selectedFiles.length === 0) return;
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
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5" />
            Photos ({photos.length})
          </div>
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
                <div>
                  <Label htmlFor="photo-files">Select Images</Label>
                  <Input
                    id="photo-files"
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleFileSelect}
                    data-testid="input-photo-files"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    You can select multiple images at once
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
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {photos.map((photo) => (
              <div key={photo.id} className="relative group">
                <img
                  src={photo.urlOrPath}
                  alt={photo.caption || 'Photo'}
                  className="w-full h-32 object-cover rounded-lg"
                  data-testid={`img-photo-${photo.id}`}
                />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center space-x-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setEditingPhoto(photo);
                      setEditCaption(photo.caption);
                    }}
                    data-testid={`button-edit-photo-${photo.id}`}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDelete(photo.id)}
                    data-testid={`button-delete-photo-${photo.id}`}
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
        )}

        {/* Edit Caption Dialog */}
        <Dialog open={!!editingPhoto} onOpenChange={(open) => !open && setEditingPhoto(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Photo Caption</DialogTitle>
            </DialogHeader>
            {editingPhoto && (
              <div className="space-y-4">
                <img
                  src={editingPhoto.urlOrPath}
                  alt="Photo preview"
                  className="w-full h-48 object-cover rounded-lg"
                />
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
                      // Note: Caption editing would require an update endpoint
                      // For now, just close the dialog
                      setEditingPhoto(null);
                      toast({
                        title: "Info",
                        description: "Caption editing will be available soon",
                      });
                    }}
                    data-testid="button-save-caption"
                  >
                    Save Caption
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