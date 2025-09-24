import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './dialog';
import { Button } from './button';
import { Input } from './input';
import { Label } from './label';
import { Card, CardContent, CardHeader, CardTitle } from './card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';
import { Calculator, Target, AlertCircle, CheckCircle } from 'lucide-react';
import { Alert, AlertDescription } from './alert';

interface LotCalculatorProps {
  isOpen: boolean;
  onClose: () => void;
  lotPrice: number;
  lotName: string;
}

interface CalculatorData {
  years: number;
  interestRate: number;
  monthlyInterestRate: number;
  price: number;
  downpayment: number;
  financedAmount: number;
  taxes: number;
  insurance: number;
  financePayment: number;
  lotRent: number;
  taxesInsurance: number;
  totalMonthly: number;
  upfrontDownpayment: number;
  securityDeposit: number;
  totalOneTime: number;
}

interface GoalSeekConfig {
  targetField: keyof CalculatorData;
  changingField: keyof CalculatorData;
  targetValue: number;
  maxIterations: number;
  tolerance: number;
}

interface GoalSeekResult {
  success: boolean;
  foundValue: number;
  iterations: number;
  finalError: number;
  message: string;
}

export function LotCalculator({ isOpen, onClose, lotPrice, lotName }: LotCalculatorProps) {
  const [data, setData] = useState<CalculatorData>({
    years: 12,
    interestRate: 9.25,
    monthlyInterestRate: 0,
    price: lotPrice,
    downpayment: 1000,
    financedAmount: 0,
    taxes: 336,
    insurance: 1464,
    financePayment: 0,
    lotRent: 525,
    taxesInsurance: 0,
    totalMonthly: 0,
    upfrontDownpayment: 0,
    securityDeposit: 1000,
    totalOneTime: 0,
  });

  // Goal Seek state
  const [showGoalSeek, setShowGoalSeek] = useState(false);
  const [goalSeekConfig, setGoalSeekConfig] = useState<GoalSeekConfig>({
    targetField: 'totalMonthly',
    changingField: 'downpayment',
    targetValue: 1000,
    maxIterations: 100,
    tolerance: 0.01,
  });
  const [goalSeekResult, setGoalSeekResult] = useState<GoalSeekResult | null>(null);
  const [isRunningGoalSeek, setIsRunningGoalSeek] = useState(false);

  // PMT function equivalent (Payment calculation)
  const calculatePMT = (rate: number, nper: number, pv: number): number => {
    if (rate === 0) return -pv / nper;
    return -(pv * rate * Math.pow(1 + rate, nper)) / (Math.pow(1 + rate, nper) - 1);
  };

  // Calculate all values for a given dataset
  const calculateAllValues = (inputData: CalculatorData): CalculatorData => {
    const monthlyRate = Math.pow(1 + inputData.interestRate / 100, 1/12) - 1;
    const financedAmount = inputData.price - inputData.downpayment;
    const financePayment = calculatePMT(monthlyRate, inputData.years * 12, financedAmount);
    const taxesInsurance = -(inputData.taxes + inputData.insurance) / 12;
    
    // Total Monthly = Finance Payment + Lot Rent + Taxes Insurance
    // Note: financePayment is negative (outgoing payment), taxesInsurance is negative (outgoing payment)
    // We want to show the total as a positive amount representing total monthly cost
    const totalMonthly = Math.abs(financePayment) + inputData.lotRent + Math.abs(taxesInsurance);
    
    const upfrontDownpayment = inputData.downpayment;
    const totalOneTime = upfrontDownpayment + inputData.securityDeposit;

    return {
      ...inputData,
      monthlyInterestRate: monthlyRate,
      financedAmount,
      financePayment,
      taxesInsurance,
      totalMonthly,
      upfrontDownpayment,
      totalOneTime,
    };
  };

  // Goal Seek algorithm using Newton-Raphson method
  const runGoalSeek = async (config: GoalSeekConfig): Promise<GoalSeekResult> => {
    const { targetField, changingField, targetValue, maxIterations, tolerance } = config;
    
    let currentData = { ...data };
    let currentValue = currentData[changingField] as number;
    let iteration = 0;
    let error = Infinity;
    
    // Initial bounds for binary search fallback
    let lowerBound = currentValue * 0.01; // 1% of current value
    let upperBound = currentValue * 100; // 100x current value
    
    // Try Newton-Raphson first
    while (iteration < maxIterations && Math.abs(error) > tolerance) {
      // Calculate current result
      currentData[changingField] = currentValue as any;
      const calculatedData = calculateAllValues(currentData);
      const currentResult = calculatedData[targetField] as number;
      error = currentResult - targetValue;
      
      if (Math.abs(error) <= tolerance) {
        break;
      }
      
      // Calculate derivative (small change method)
      const delta = Math.abs(currentValue) * 0.001 || 0.001;
      currentData[changingField] = (currentValue + delta) as any;
      const deltaData = calculateAllValues(currentData);
      const deltaResult = deltaData[targetField] as number;
      const derivative = (deltaResult - currentResult) / delta;
      
      if (Math.abs(derivative) < 1e-10) {
        // Derivative too small, switch to binary search
        break;
      }
      
      // Newton-Raphson step
      const newValue = currentValue - error / derivative;
      
      // Bounds checking
      if (newValue < lowerBound || newValue > upperBound) {
        break;
      }
      
      currentValue = newValue;
      iteration++;
    }
    
    // If Newton-Raphson didn't converge, try binary search
    if (Math.abs(error) > tolerance && iteration < maxIterations) {
      currentValue = (lowerBound + upperBound) / 2;
      
      while (iteration < maxIterations && Math.abs(error) > tolerance) {
        currentData[changingField] = currentValue as any;
        const calculatedData = calculateAllValues(currentData);
        const currentResult = calculatedData[targetField] as number;
        error = currentResult - targetValue;
        
        if (Math.abs(error) <= tolerance) {
          break;
        }
        
        if (error > 0) {
          upperBound = currentValue;
        } else {
          lowerBound = currentValue;
        }
        
        currentValue = (lowerBound + upperBound) / 2;
        iteration++;
      }
    }
    
    const success = Math.abs(error) <= tolerance;
    const message = success 
      ? `Goal Seek completed successfully in ${iteration} iterations.`
      : `Goal Seek did not converge within ${maxIterations} iterations. Final error: ${Math.abs(error).toFixed(4)}`;
    
    return {
      success,
      foundValue: currentValue,
      iterations: iteration,
      finalError: Math.abs(error),
      message,
    };
  };

  // Run Goal Seek
  const handleGoalSeek = async () => {
    setIsRunningGoalSeek(true);
    setGoalSeekResult(null);
    
    try {
      const result = await runGoalSeek(goalSeekConfig);
      setGoalSeekResult(result);
      
      if (result.success) {
        // Apply the found value to the data
        const newData = { ...data };
        newData[goalSeekConfig.changingField] = result.foundValue as any;
        setData(newData);
      }
    } catch (error) {
      setGoalSeekResult({
        success: false,
        foundValue: 0,
        iterations: 0,
        finalError: Infinity,
        message: `Error running Goal Seek: ${error}`,
      });
    } finally {
      setIsRunningGoalSeek(false);
    }
  };

  // Update calculated fields when inputs change
  useEffect(() => {
    const calculatedData = calculateAllValues(data);
    setData(calculatedData);
  }, [data.years, data.interestRate, data.price, data.downpayment, data.taxes, data.insurance, data.lotRent, data.securityDeposit]);

  // Update price when lotPrice prop changes
  useEffect(() => {
    setData(prev => ({ ...prev, price: lotPrice }));
  }, [lotPrice]);

  const handleInputChange = (field: keyof CalculatorData, value: string) => {
    const numValue = parseFloat(value) || 0;
    setData(prev => ({ ...prev, [field]: numValue }));
  };

  // Field display names
  const getFieldDisplayName = (field: keyof CalculatorData): string => {
    const fieldNames: Record<keyof CalculatorData, string> = {
      years: 'Years',
      interestRate: 'Interest Rate',
      monthlyInterestRate: 'Monthly Interest Rate',
      price: 'Price',
      downpayment: 'Downpayment',
      financedAmount: 'Financed Amount',
      taxes: 'Taxes',
      insurance: 'Insurance',
      financePayment: 'Finance Payment',
      lotRent: 'Lot Rent',
      taxesInsurance: 'Taxes Insurance',
      totalMonthly: 'Total Monthly',
      upfrontDownpayment: 'Upfront Downpayment',
      securityDeposit: 'Security Deposit',
      totalOneTime: 'Total One Time',
    };
    return fieldNames[field];
  };

  // Get changeable fields (input fields only)
  const getChangeableFields = (): (keyof CalculatorData)[] => {
    return ['years', 'interestRate', 'price', 'downpayment', 'taxes', 'insurance', 'lotRent', 'securityDeposit'];
  };

  // Get target fields (calculated fields)
  const getTargetFields = (): (keyof CalculatorData)[] => {
    return ['monthlyInterestRate', 'financedAmount', 'financePayment', 'taxesInsurance', 'totalMonthly', 'upfrontDownpayment', 'totalOneTime'];
  };

  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Math.abs(value));
  };

  const formatPercentage = (value: number): string => {
    return `${(value * 100).toFixed(3)}%`;
  };

  // Format found value based on field type
  const formatFoundValue = (field: keyof CalculatorData, value: number): string => {
    const monetaryFields: (keyof CalculatorData)[] = [
      'price', 'downpayment', 'financedAmount', 'taxes', 'insurance', 
      'financePayment', 'lotRent', 'taxesInsurance', 'totalMonthly', 
      'upfrontDownpayment', 'securityDeposit', 'totalOneTime'
    ];
    
    const percentageFields: (keyof CalculatorData)[] = [
      'interestRate', 'monthlyInterestRate'
    ];
    
    if (monetaryFields.includes(field)) {
      return formatCurrency(value);
    } else if (percentageFields.includes(field)) {
      return `${value.toFixed(3)}%`;
    } else if (field === 'years') {
      return `${value.toFixed(1)} years`;
    } else {
      // Default to 2 decimal places for other numeric values
      return value.toFixed(2);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="w-5 h-5" />
            Contract For Deed Calculator - {lotName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Contract for title items */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Contract for title items</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="years">Years</Label>
                  <Input
                    id="years"
                    type="number"
                    value={data.years}
                    onChange={(e) => handleInputChange('years', e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Months</Label>
                  <Input
                    value={data.years * 12}
                    disabled
                    className="mt-1 bg-gray-50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="interestRate">Interest rate (%)</Label>
                  <Input
                    id="interestRate"
                    type="number"
                    step="0.01"
                    value={data.interestRate}
                    onChange={(e) => handleInputChange('interestRate', e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Monthly Interest rate</Label>
                  <Input
                    value={formatPercentage(data.monthlyInterestRate)}
                    disabled
                    className="mt-1 bg-gray-50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="price">Price</Label>
                  <Input
                    id="price"
                    type="number"
                    value={data.price}
                    onChange={(e) => handleInputChange('price', e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="downpayment">Downpayment</Label>
                  <Input
                    id="downpayment"
                    type="number"
                    value={data.downpayment}
                    onChange={(e) => handleInputChange('downpayment', e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>

              <div>
                <Label>Financed amount</Label>
                <Input
                  value={formatCurrency(data.financedAmount)}
                  disabled
                  className="mt-1 bg-gray-50"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="taxes">Taxes</Label>
                  <Input
                    id="taxes"
                    type="number"
                    value={data.taxes}
                    onChange={(e) => handleInputChange('taxes', e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="insurance">Insurance</Label>
                  <Input
                    id="insurance"
                    type="number"
                    value={data.insurance}
                    onChange={(e) => handleInputChange('insurance', e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t">
                <div>
                  <Label>Finance payment</Label>
                  <Input
                    value={formatCurrency(data.financePayment)}
                    disabled
                    className="mt-1 bg-red-50 text-red-700 font-semibold"
                  />
                </div>

                <div>
                  <Label htmlFor="lotRent">Lot rent</Label>
                  <Input
                    id="lotRent"
                    type="number"
                    value={data.lotRent}
                    onChange={(e) => handleInputChange('lotRent', e.target.value)}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label>Taxes Insurance</Label>
                  <Input
                    value={formatCurrency(data.taxesInsurance)}
                    disabled
                    className="mt-1 bg-red-50 text-red-700 font-semibold"
                  />
                </div>

                <div>
                  <Label>Total Monthly</Label>
                  <Input
                    value={formatCurrency(data.totalMonthly)}
                    disabled
                    className="mt-1 bg-red-50 text-red-700 font-bold text-lg"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Upfront section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Upfront</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Downpayment</Label>
                <Input
                  value={formatCurrency(data.upfrontDownpayment)}
                  disabled
                  className="mt-1 bg-gray-50"
                />
              </div>

              <div>
                <Label htmlFor="securityDeposit">Security deposit</Label>
                <Input
                  id="securityDeposit"
                  type="number"
                  value={data.securityDeposit}
                  onChange={(e) => handleInputChange('securityDeposit', e.target.value)}
                  className="mt-1"
                />
              </div>

              <div>
                <Label>Total 1 time</Label>
                <Input
                  value={formatCurrency(data.totalOneTime)}
                  disabled
                  className="mt-1 bg-blue-50 text-blue-700 font-bold text-lg"
                />
              </div>
            </CardContent>
          </Card>

          {/* Goal Seek Section */}
          {showGoalSeek && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Target className="w-5 h-5" />
                  Goal Seek Configuration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="targetField">Target Field (Formula)</Label>
                    <Select 
                      value={goalSeekConfig.targetField} 
                      onValueChange={(value) => setGoalSeekConfig(prev => ({ ...prev, targetField: value as keyof CalculatorData }))}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select target field" />
                      </SelectTrigger>
                      <SelectContent>
                        {getTargetFields().map(field => (
                          <SelectItem key={field} value={field}>
                            {getFieldDisplayName(field)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="changingField">Changing Field (Input)</Label>
                    <Select 
                      value={goalSeekConfig.changingField} 
                      onValueChange={(value) => setGoalSeekConfig(prev => ({ ...prev, changingField: value as keyof CalculatorData }))}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select changing field" />
                      </SelectTrigger>
                      <SelectContent>
                        {getChangeableFields().map(field => (
                          <SelectItem key={field} value={field}>
                            {getFieldDisplayName(field)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="targetValue">Target Value</Label>
                  <Input
                    id="targetValue"
                    type="number"
                    step="0.01"
                    value={goalSeekConfig.targetValue}
                    onChange={(e) => setGoalSeekConfig(prev => ({ ...prev, targetValue: parseFloat(e.target.value) || 0 }))}
                    className="mt-1"
                    placeholder="Enter desired target value"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="maxIterations">Max Iterations</Label>
                    <Input
                      id="maxIterations"
                      type="number"
                      value={goalSeekConfig.maxIterations}
                      onChange={(e) => setGoalSeekConfig(prev => ({ ...prev, maxIterations: parseInt(e.target.value) || 100 }))}
                      className="mt-1"
                      min="1"
                      max="1000"
                    />
                  </div>
                  <div>
                    <Label htmlFor="tolerance">Tolerance</Label>
                    <Input
                      id="tolerance"
                      type="number"
                      step="0.001"
                      value={goalSeekConfig.tolerance}
                      onChange={(e) => setGoalSeekConfig(prev => ({ ...prev, tolerance: parseFloat(e.target.value) || 0.01 }))}
                      className="mt-1"
                      min="0.001"
                      max="10"
                    />
                  </div>
                </div>

                <div className="flex justify-center pt-4">
                  <Button 
                    onClick={handleGoalSeek}
                    disabled={isRunningGoalSeek}
                    className="flex items-center gap-2"
                  >
                    {isRunningGoalSeek ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Running...
                      </>
                    ) : (
                      <>
                        <Target className="w-4 h-4" />
                        Run Goal Seek
                      </>
                    )}
                  </Button>
                </div>

                {/* Goal Seek Results */}
                {goalSeekResult && (
                  <Alert className={goalSeekResult.success ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}>
                    <div className="flex items-start gap-2">
                      {goalSeekResult.success ? (
                        <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                      ) : (
                        <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                      )}
                      <div className="flex-1">
                        <AlertDescription className={goalSeekResult.success ? "text-green-800" : "text-red-800"}>
                          <div className="font-semibold mb-2">{goalSeekResult.message}</div>
                          <div className="space-y-1 text-sm">
                            <div>Found Value: <strong>{formatFoundValue(goalSeekConfig.changingField, goalSeekResult.foundValue)}</strong></div>
                            <div>Iterations: {goalSeekResult.iterations}</div>
                            <div>Final Error: {goalSeekResult.finalError.toFixed(6)}</div>
                          </div>
                        </AlertDescription>
                      </div>
                    </div>
                  </Alert>
                )}
              </CardContent>
            </Card>
          )}

          <div className="flex justify-between pt-4 border-t">
            <Button 
              onClick={() => setShowGoalSeek(!showGoalSeek)} 
              variant="outline"
              className="flex items-center gap-2"
            >
              <Target className="w-4 h-4" />
              Goal Seek
            </Button>
            <Button onClick={onClose} variant="outline">
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
