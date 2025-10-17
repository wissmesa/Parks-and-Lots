import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CreditCard, Upload, FileText, Calendar, DollarSign } from "lucide-react";
import { format } from "date-fns";

interface Payment {
  id: string;
  type: string;
  amount: string;
  dueDate: string;
  paidDate: string | null;
  status: string;
  description: string | null;
  notes: string | null;
}

export default function TenantPayments() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    type: 'RENT' as Payment['type'],
    amount: '',
    description: '',
    notes: '',
    paymentProof: null as File | null
  });

  // Fetch tenant payments
  const { data: payments = [], isLoading: paymentsLoading } = useQuery<Payment[]>({
    queryKey: ['/api/tenant/payments'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/tenant/payments');
      const data = await response.json();
      return data.payments || [];
    },
    enabled: user?.role === 'TENANT',
  });

  // Submit payment mutation
  const submitPaymentMutation = useMutation({
    mutationFn: async (paymentData: typeof paymentForm) => {
      const formData = new FormData();
      formData.append('type', paymentData.type);
      formData.append('amount', paymentData.amount);
      formData.append('description', paymentData.description);
      formData.append('notes', paymentData.notes);
      if (paymentData.paymentProof) {
        formData.append('paymentProof', paymentData.paymentProof);
      }

      const response = await fetch('/api/tenant/payments', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to submit payment');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Payment Submitted",
        description: "Your payment has been submitted successfully and is pending review.",
      });
      setIsPaymentModalOpen(false);
      setPaymentForm({
        type: 'RENT',
        amount: '',
        description: '',
        notes: '',
        paymentProof: null
      });
      queryClient.invalidateQueries({ queryKey: ['/api/tenant/payments'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to submit payment",
        variant: "destructive",
      });
    },
  });

  const handlePaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentForm.amount || !paymentForm.type) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }
    submitPaymentMutation.mutate(paymentForm);
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'PAID':
        return 'default';
      case 'PENDING':
        return 'secondary';
      case 'OVERDUE':
        return 'destructive';
      case 'PARTIAL':
        return 'outline';
      default:
        return 'secondary';
    }
  };

  const getPaymentTypeLabel = (type: string) => {
    switch (type) {
      case 'RENT': return 'Rent';
      case 'DEPOSIT': return 'Deposit';
      case 'LATE_FEE': return 'Late Fee';
      case 'MAINTENANCE': return 'Maintenance';
      case 'UTILITY': return 'Utility';
      case 'OTHER': return 'Other';
      default: return type;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PAID':
        return 'text-green-600';
      case 'PENDING':
        return 'text-yellow-600';
      case 'OVERDUE':
        return 'text-red-600';
      case 'PARTIAL':
        return 'text-blue-600';
      default:
        return 'text-gray-600';
    }
  };

  // Group payments by status
  const groupedPayments = {
    pending: payments.filter(p => p.status === 'PENDING'),
    paid: payments.filter(p => p.status === 'PAID'),
    overdue: payments.filter(p => p.status === 'OVERDUE'),
    other: payments.filter(p => !['PENDING', 'PAID', 'OVERDUE'].includes(p.status))
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Payment Management</h1>
          <p className="text-muted-foreground">
            View your payment history and submit new payments
          </p>
        </div>
        <Dialog open={isPaymentModalOpen} onOpenChange={setIsPaymentModalOpen}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Submit Payment
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Submit Payment</DialogTitle>
              <DialogDescription>
                Upload your payment information and proof of payment
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handlePaymentSubmit} className="space-y-4">
              <div>
                <Label htmlFor="payment-type">Payment Type *</Label>
                <Select value={paymentForm.type} onValueChange={(value) => setPaymentForm(prev => ({ ...prev, type: value as any }))}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select payment type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="RENT">Rent</SelectItem>
                    <SelectItem value="DEPOSIT">Deposit</SelectItem>
                    <SelectItem value="LATE_FEE">Late Fee</SelectItem>
                    <SelectItem value="MAINTENANCE">Maintenance</SelectItem>
                    <SelectItem value="UTILITY">Utility</SelectItem>
                    <SelectItem value="OTHER">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="payment-amount">Amount *</Label>
                <MoneyInput
                  id="payment-amount"
                  step="0.01"
                  min="0"
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm(prev => ({ ...prev, amount: e.target.value }))}
                  placeholder="0.00"
                  className="mt-1"
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="payment-description">Description</Label>
                <Input
                  id="payment-description"
                  value={paymentForm.description}
                  onChange={(e) => setPaymentForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Payment description"
                  className="mt-1"
                />
              </div>
              
              <div>
                <Label htmlFor="payment-proof">Payment Proof (Receipt/Screenshot)</Label>
                <Input
                  id="payment-proof"
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => setPaymentForm(prev => ({ ...prev, paymentProof: e.target.files?.[0] || null }))}
                  className="mt-1"
                />
              </div>
              
              <div>
                <Label htmlFor="payment-notes">Notes</Label>
                <Textarea
                  id="payment-notes"
                  value={paymentForm.notes}
                  onChange={(e) => setPaymentForm(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Additional notes"
                  rows={3}
                  className="mt-1"
                />
              </div>
              
              <div className="flex gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsPaymentModalOpen(false)} className="flex-1">
                  Cancel
                </Button>
                <Button type="submit" disabled={submitPaymentMutation.isPending} className="flex-1">
                  {submitPaymentMutation.isPending ? "Submitting..." : "Submit Payment"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {paymentsLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Loading payments...</p>
        </div>
      ) : payments.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No payment history found</h3>
            <p className="text-muted-foreground mb-4">You haven't made any payments yet.</p>
            <Button onClick={() => setIsPaymentModalOpen(true)}>
              <Upload className="h-4 w-4 mr-2" />
              Submit Your First Payment
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Payment Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Pending</p>
                    <p className="text-2xl font-bold text-yellow-600">{groupedPayments.pending.length}</p>
                  </div>
                  <Calendar className="h-8 w-8 text-yellow-600" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Paid</p>
                    <p className="text-2xl font-bold text-green-600">{groupedPayments.paid.length}</p>
                  </div>
                  <CreditCard className="h-8 w-8 text-green-600" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Overdue</p>
                    <p className="text-2xl font-bold text-red-600">{groupedPayments.overdue.length}</p>
                  </div>
                  <DollarSign className="h-8 w-8 text-red-600" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total</p>
                    <p className="text-2xl font-bold">{payments.length}</p>
                  </div>
                  <FileText className="h-8 w-8 text-primary" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Payment History */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Payment History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {payments
                  .sort((a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime())
                  .map((payment) => (
                  <div key={payment.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-medium">{getPaymentTypeLabel(payment.type)}</h3>
                        <Badge variant={getStatusBadgeVariant(payment.status)}>
                          {payment.status}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground space-y-1">
                        <p>Due: {format(new Date(payment.dueDate), 'MMM dd, yyyy')}</p>
                        {payment.paidDate && (
                          <p>Paid: {format(new Date(payment.paidDate), 'MMM dd, yyyy')}</p>
                        )}
                        {payment.description && (
                          <p>Description: {payment.description}</p>
                        )}
                        {payment.notes && (
                          <p>Notes: {payment.notes}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-2xl font-bold ${getStatusColor(payment.status)}`}>
                        ${payment.amount}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
