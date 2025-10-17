import * as React from "react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

const MoneyInput = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, value, onChange, ...props }, ref) => {
    const hasValue = value !== undefined && value !== null && value !== '';
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      // Allow only numbers and decimal point
      const newValue = e.target.value.replace(/[^0-9.]/g, '');
      
      // Prevent multiple decimal points
      const parts = newValue.split('.');
      const formatted = parts.length > 2 
        ? parts[0] + '.' + parts.slice(1).join('')
        : newValue;
      
      // Update the input value
      e.target.value = formatted;
      
      if (onChange) {
        onChange(e);
      }
    };
    
    return (
      <div className="relative">
        {hasValue && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
            $
          </span>
        )}
        <Input
          type="text"
          inputMode="decimal"
          className={cn(hasValue ? "pl-6" : "", className)}
          value={value}
          onChange={handleChange}
          ref={ref}
          {...props}
        />
      </div>
    )
  }
)
MoneyInput.displayName = "MoneyInput"

export { MoneyInput }

