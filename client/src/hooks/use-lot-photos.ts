import { useQuery } from "@tanstack/react-query";

export function useLotPhotos(lotId: string) {
  return useQuery<any[]>({
    queryKey: ["/api/lots", lotId, "photos"],
    enabled: !!lotId,
  });
}

export function useFirstLotPhoto(lotId: string) {
  const { data: photos = [], isLoading } = useLotPhotos(lotId);
  
  return {
    firstPhoto: photos.length > 0 ? photos[0] : null,
    hasPhotos: photos.length > 0,
    isLoading
  };
}