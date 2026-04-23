import { z } from 'zod';

/**
 * Схема для входу в CRM (менеджери)
 */
export const LoginSchema = z.object({
  username: z.string().min(2, 'Ім\'я користувача занадто коротке').trim(),
  password: z.string().min(4, 'Пароль занадто короткий'),
});

export type LoginInput = z.infer<typeof LoginSchema>;

/**
 * Схема для входу в Worker App (робітники за PIN-кодом)
 */
export const WorkerLoginSchema = z.object({
  pin: z.string().length(4, 'PIN-код повинен складатися з 4 цифр'),
});

export type WorkerLoginInput = z.infer<typeof WorkerLoginSchema>;
