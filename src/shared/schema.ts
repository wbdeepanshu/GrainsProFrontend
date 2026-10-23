import { z } from "zod";

// User type definition
export interface User {
  id: number;
  userId: string;
  mobile: string;
  password: string;
  name: string;
  roleId: number;
  role: string;
  accessToken: string | null;
  tokenType: string;
  lastLogin: string | null;
}

// Dashboard data type definition
export interface DashboardData {
  id: number;
  date: string;
  userId: string;
  totalInwardEntries: number;
  approvedEntries: number;
  pendingEntries: number;
  rejectedEntries: number;
  consumptionNotes: number;
  productionNotes: number;
  brandTransfers: number;
  stockTransfers: number;
  tallyRunning: boolean;
  totalVoucherTypes: number;
  hamaliEntries: number;
  hamaliAmount: number;
  tallyItemCount: number;
  syncedItemCount: number;
  isSynced: boolean;
}

// Stock Journal types
export interface StockJournal {
  id: number;
  transaction_id: string;
  voucher_number: string;
  voucher_type_name: string;
  date: string;
  reference?: string;
  description?: string;
  total_items: number;
  total_quantity: number;
  is_tally_synced: boolean;
  created_at: string;
  updated_at: string;
}

export interface VoucherType {
  id: number;
  name: string;
  description?: string;
  is_active: boolean;
}

export interface StockJournalDetail {
  id: number;
  transaction_id: string;
  voucher_number: string;
  voucher_type_name: string;
  date: string;
  reference?: string;
  description?: string;
  remarks?: string;
  destination_godown?: string;
  total_items: number;
  total_quantity: number;
  is_tally_synced: boolean;
  inventory_entries_in?: InventoryEntry[];
  inventory_entries_out?: InventoryEntry[];
  created_at: string;
  updated_at: string;
}

export interface InventoryEntry {
  id: number;
  stock_item: string;
  actual_qty: {
    quantity: number;
    unit: string;
    full_text: string;
  };
  batch_allocations?: BatchAllocation[];
}

export interface BatchAllocation {
  id: number;
  batch_name: string;
  godown: string;
  actual_qty: {
    quantity: number;
    unit: string;
    full_text: string;
  };
}

export interface StockJournalFilters {
  from_date?: string;
  to_date?: string;
  voucher_type?: string;
  is_tally_synced?: boolean;
  page?: number;
}

// Form validation schemas
export const loginSchema = z.object({
  mobile: z
    .string()
    .min(1, "Mobile number is required")
    .regex(/^\d{10}$/, "Mobile number must be exactly 10 digits"),
  password: z
    .string()
    .min(1, "Password is required")
    .min(4, "Password must be at least 6 characters"),
  rememberMe: z.boolean().optional(),
});

export const signupSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .min(2, "Name must be at least 2 characters"),
  mobile: z
    .string()
    .min(1, "Mobile number is required")
    .regex(/^\d{10}$/, "Mobile number must be exactly 10 digits"),
  email: z
    .string()
    .email("Please enter a valid email address")
    .optional()
    .or(z.literal("")),
  password: z
    .string()
    .min(1, "Password is required")
    .min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string().min(1, "Please confirm your password"),
  agreeToTerms: z.boolean().refine((val) => val === true, {
    message: "You must agree to the Terms & Conditions",
  }),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export const forgotPasswordSchema = z.object({
  mobile: z
    .string()
    .min(1, "Mobile number is required")
    .regex(/^\d{10}$/, "Mobile number must be exactly 10 digits"),
});

export const resetPasswordSchema = z
  .object({
    mobile: z
      .string()
      .min(1, "Mobile number is required")
      .regex(/^\d{10}$/, "Mobile number must be exactly 10 digits"),
    otp: z
      .string()
      .min(1, "OTP is required")
      .length(4, "OTP must be 4 digits")
      .regex(/^\d{4}$/, "OTP must be 4 digits"),
    new_password: z
      .string()
      .min(1, "New password is required")
      .min(6, "Password must be at least 6 characters"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.new_password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

// Form data types
export type LoginFormData = z.infer<typeof loginSchema>;
export type SignupFormData = z.infer<typeof signupSchema>;
export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;
