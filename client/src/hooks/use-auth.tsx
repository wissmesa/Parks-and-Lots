import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AuthManager, type User } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";

interface LoginCredentials {
  email: string;
  password: string;
}

interface AcceptInviteData {
  token: string;
  password: string;
  fullName: string;
}

export function useAuth() {
  const queryClient = useQueryClient();

  const { data: user, isLoading } = useQuery<User>({
    queryKey: ["/api/auth/me"],
    enabled: AuthManager.isAuthenticated(),
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginCredentials) => {
      const response = await apiRequest("POST", "/api/auth/login", credentials);
      return response.json();
    },
    onSuccess: (data) => {
      AuthManager.setAuth(data);
      queryClient.setQueryData(["/api/auth/me"], data.user);
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/auth/logout");
    },
    onSuccess: () => {
      AuthManager.clearAuth();
      queryClient.removeQueries({ queryKey: ["/api/auth/me"] });
      queryClient.clear();
    },
  });

  const acceptInviteMutation = useMutation({
    mutationFn: async (data: AcceptInviteData) => {
      const response = await apiRequest("POST", "/api/auth/accept-invite", data);
      return response.json();
    },
    onSuccess: (data) => {
      AuthManager.setAuth(data);
      queryClient.setQueryData(["/api/auth/me"], data.user);
    },
  });

  return {
    user: user || AuthManager.getUser(),
    isLoading,
    isAuthenticated: AuthManager.isAuthenticated(),
    isAdmin: AuthManager.isAdmin(),
    isManager: AuthManager.isManager(),
    login: loginMutation.mutateAsync,
    logout: logoutMutation.mutateAsync,
    acceptInvite: acceptInviteMutation.mutateAsync,
    isLoginLoading: loginMutation.isPending,
    isLogoutLoading: logoutMutation.isPending,
    isAcceptInviteLoading: acceptInviteMutation.isPending,
  };
}
