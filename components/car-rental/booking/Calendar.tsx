"use client";

import { useEffect, useState } from "react";
import { DateRange } from "react-day-picker";
import { Calendar as CalendarUI } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

// Enhanced Calendar Component using Shadcn UI
const Calendar: React.FC<{
  selectedStartDate: string;
  selectedEndDate: string;
  onDateSelect: (date: string, type: "start" | "end") => void;
  currentSelection: "start" | "end";
  setCurrentSelection: (type: "start" | "end") => void;
  text: string;
  dateType?: "pickup" | "dropoff";
  disabled?: boolean;
}> = ({
  selectedStartDate,
  selectedEndDate,
  onDateSelect,
  currentSelection,
  setCurrentSelection,
  text,
  dateType = "pickup",
  disabled = false,
}) => {
  // Convert string dates to Date objects for the calendar
  const [date, setDate] = useState<DateRange | undefined>(undefined);
  const [isOpen, setIsOpen] = useState(false);

  // Initialize date range when props change
  useEffect(() => {
    const range: DateRange = {
      from: selectedStartDate ? new Date(selectedStartDate) : undefined,
      to: selectedEndDate ? new Date(selectedEndDate) : undefined,
    };

    // Only update if there's a change to avoid infinite loops
    if (JSON.stringify(date) !== JSON.stringify(range)) {
      setDate(range);
    }
  }, [selectedStartDate, selectedEndDate]);

  // Handle date selection
  const handleSelect = (range: DateRange | undefined) => {
    if (!range) return;

    setDate(range);

    if (dateType === "pickup") {
      // Handle pickup date selection
      if (range.from) {
        const formattedDate = format(range.from, "yyyy-MM-dd");
        onDateSelect(formattedDate, "start");
        setCurrentSelection("end");
      }
    } else {
      // Handle dropoff date selection
      if (dateType === "dropoff" && range.from && selectedStartDate) {
        // For dropoff, we want to set the 'to' date
        if (range.to) {
          const formattedDate = format(range.to, "yyyy-MM-dd");
          onDateSelect(formattedDate, "end");
        } else if (range.from && range.from >= new Date(selectedStartDate)) {
          // If only 'from' is selected and it's valid, use it as the end date
          const formattedDate = format(range.from, "yyyy-MM-dd");
          onDateSelect(formattedDate, "end");
        }
      }
    }

    // Close popover after selection
    setIsOpen(false);
  };

  // Handle single date selection for pickup
  const handleSingleSelect = (selectedDate: Date | undefined) => {
    if (!selectedDate) return;

    const formattedDate = format(selectedDate, "yyyy-MM-dd");
    onDateSelect(formattedDate, "start");
    setCurrentSelection("end");
    setIsOpen(false);
  };

  const handleOpenChange = (open: boolean) => {
    if (disabled) return;

    if (open) {
      // Set the current selection based on the button type
      if (dateType === "pickup") {
        setCurrentSelection("start");
      } else if (dateType === "dropoff" && selectedStartDate) {
        setCurrentSelection("end");
      }
    }

    setIsOpen(open);
  };

  // Helper function to check if date should be disabled
  const isDateDisabled = (date: Date) => {
    // Disable past dates
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (date < today) return true;

    // For dropoff, disable dates before pickup date
    if (dateType === "dropoff" && selectedStartDate) {
      return date < new Date(selectedStartDate);
    }

    return false;
  };

  return (
    <div className="w-full">
      <Popover open={isOpen} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <button
            disabled={disabled}
            className={cn(
              "w-full p-3 border border-slate-200 text-left text-xs sm:text-sm transition-colors cursor-pointer focus:ring-2 focus:ring-slate-800 focus:border-transparent",
              disabled
                ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                : "bg-white hover:bg-slate-50"
            )}
          >
            {dateType === "pickup" && selectedStartDate ? (
              text
            ) : dateType === "dropoff" && selectedEndDate ? (
              text
            ) : (
              <span
                className={cn(
                  "flex items-center",
                  disabled ? "text-slate-400" : "text-slate-400"
                )}
              >
                <CalendarIcon className="h-4 w-4 mr-2" />
                {text}
              </span>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="w-auto p-0 border border-slate-200 rounded-none"
          align="start"
        >
          {dateType === "pickup" ? (
            <CalendarUI
              mode="single"
              defaultMonth={
                selectedStartDate ? new Date(selectedStartDate) : new Date()
              }
              selected={
                selectedStartDate ? new Date(selectedStartDate) : undefined
              }
              onSelect={handleSingleSelect}
              numberOfMonths={2}
              disabled={isDateDisabled}
              className="bg-white"
            />
          ) : (
            <CalendarUI
              initialFocus
              mode="range"
              required
              defaultMonth={
                selectedStartDate ? new Date(selectedStartDate) : new Date()
              }
              selected={date}
              onSelect={handleSelect}
              numberOfMonths={2}
              disabled={isDateDisabled}
              className="bg-white"
            />
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default Calendar;
