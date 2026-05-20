import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * دالة مساعدة لتنسيق السعر بالدينار العراقي
 * تقوم بإضافة 3 أصفار للأسعار الصغيرة (مثال: 217 يتحول إلى 217,000) وتنسيق الفواصل
 */
export function formatIQD(price: number | string | undefined | null): string {
  if (price === undefined || price === null || price === '') return '0';
  const num = typeof price === 'string' ? parseFloat(price) : price;
  if (isNaN(num)) return '0';
  
  // إذا كان السعر صغيراً (أقل من 10,000)، نضربه في 1000 لإضافة الأصفار
  const finalPrice = num < 10000 ? num * 1000 : num;
  
  // نستخدم 'en-US' للحصول على فواصل الآلاف المألوفة 217,000
  return finalPrice.toLocaleString('en-US');
}
