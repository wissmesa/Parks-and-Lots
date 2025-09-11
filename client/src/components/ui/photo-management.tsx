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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
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
    mutationFn: async ({ file, caption }: { file: File; caption: string }) => {
      const formData = new FormData();
      formData.append('photo', file);
      formData.append('caption', caption);
      formData.append('sortOrder', String(photos.length));

      const response = await fetch(`/api/${endpointBase}/${entityId}/photos`, {
        method: 'POST',
        body: formData,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/${endpointBase}`, entityId, 'photos'] });
      setSelectedFile(null);
      setCaption("");
      setIsUploadOpen(false);
      toast({
        title: "Success",
        description: "Photo uploaded successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to upload photo",
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
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "Error",
          description: "File size must be less than 10MB",
          variant: "destructive",
        });
        return;
      }
      if (!file.type.startsWith('image/')) {
        toast({
          title: "Error",
          description: "Please select an image file",
          variant: "destructive",
        });
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleUpload = () => {
    if (!selectedFile) return;
    uploadMutation.mutate({ file: selectedFile, caption });
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
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Upload Photo for {entityName}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="photo-file">Select Image</Label>
                  <Input
                    id="photo-file"
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    data-testid="input-photo-file"
                  />
                  {selectedFile && (
                    <p className="text-sm text-muted-foreground mt-1">
                      Selected: {selectedFile.name}
                    </p>
                  )}
                </div>
                <div>
                  <Label htmlFor="photo-caption">Caption (Optional)</Label>
                  <Input
                    id="photo-caption"
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    placeholder="Enter a caption for this photo"
                    data-testid="input-photo-caption"
                  />
                </div>
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
                    disabled={!selectedFile || uploadMutation.isPending}
                    data-testid="button-upload-photo"
                  >
                    {uploadMutation.isPending ? "Uploading..." : "Upload"}
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