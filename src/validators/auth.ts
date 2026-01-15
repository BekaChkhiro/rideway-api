import { z } from 'zod';

// Common validators
const emailSchema = z.string().email('არასწორი ელ.ფოსტა');
const phoneSchema = z
  .string()
  .regex(/^\+995\d{9}$/, 'ფორმატი: +995XXXXXXXXX');
const passwordSchema = z
  .string()
  .min(8, 'მინიმუმ 8 სიმბოლო')
  .max(100, 'მაქსიმუმ 100 სიმბოლო')
  .regex(/[A-Z]/, 'უნდა შეიცავდეს დიდ ასოს')
  .regex(/[a-z]/, 'უნდა შეიცავდეს პატარა ასოს')
  .regex(/[0-9]/, 'უნდა შეიცავდეს ციფრს');
const usernameSchema = z
  .string()
  .min(3, 'მინიმუმ 3 სიმბოლო')
  .max(30, 'მაქსიმუმ 30 სიმბოლო')
  .regex(/^[a-zA-Z0-9_]+$/, 'მხოლოდ ლათინური ასოები, ციფრები და _');

// Register
export const registerSchema = z
  .object({
    email: emailSchema.optional(),
    phone: phoneSchema.optional(),
    password: passwordSchema,
    username: usernameSchema,
    fullName: z.string().min(2, 'მინიმუმ 2 სიმბოლო').max(100, 'მაქსიმუმ 100 სიმბოლო'),
  })
  .refine((data) => data.email || data.phone, {
    message: 'ელ.ფოსტა ან ტელეფონი სავალდებულოა',
    path: ['email'],
  });

export type RegisterInput = z.infer<typeof registerSchema>;

// Login
export const loginSchema = z
  .object({
    email: emailSchema.optional(),
    phone: phoneSchema.optional(),
    password: z.string().min(1, 'პაროლი სავალდებულოა'),
  })
  .refine((data) => data.email || data.phone, {
    message: 'ელ.ფოსტა ან ტელეფონი სავალდებულოა',
    path: ['email'],
  });

export type LoginInput = z.infer<typeof loginSchema>;

// Verify OTP
export const verifyOtpSchema = z.object({
  userId: z.string().uuid('არასწორი userId'),
  code: z.string().length(6, 'კოდი უნდა იყოს 6 ციფრიანი'),
  type: z.enum(['EMAIL', 'PHONE']),
});

export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;

// Refresh Token
export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token სავალდებულოა'),
});

export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;

// Forgot Password
export const forgotPasswordSchema = z
  .object({
    email: emailSchema.optional(),
    phone: phoneSchema.optional(),
  })
  .refine((data) => data.email || data.phone, {
    message: 'ელ.ფოსტა ან ტელეფონი სავალდებულოა',
    path: ['email'],
  });

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

// Reset Password
export const resetPasswordSchema = z.object({
  userId: z.string().uuid('არასწორი userId'),
  code: z.string().length(6, 'კოდი უნდა იყოს 6 ციფრიანი'),
  newPassword: passwordSchema,
});

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

// Resend OTP
export const resendOtpSchema = z.object({
  userId: z.string().uuid('არასწორი userId'),
  type: z.enum(['EMAIL', 'PHONE']),
});

export type ResendOtpInput = z.infer<typeof resendOtpSchema>;

// Change Password
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'მიმდინარე პაროლი სავალდებულოა'),
  newPassword: passwordSchema,
});

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
