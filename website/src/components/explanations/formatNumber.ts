// Chỉ làm tròn để hiển thị; các phép tính luôn giữ nguyên độ chính xác số.
export function formatAnswerNumber(value: number, digits = 3) {
  return value.toLocaleString('vi-VN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}
