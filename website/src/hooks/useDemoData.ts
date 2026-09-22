import { useEffect, useState } from 'react';
import type { DemoBundle } from '../demoTypes';

/**
 * Đọc kết quả đã được scripts/export_demo.py đối chiếu với checkpoint PyTorch.
 * Trình duyệt không gọi train(), không cập nhật trọng số, không tự tạo dự đoán.
 */
export function useDemoData() {
  const [bundle, setBundle] = useState<DemoBundle | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/data/demo.json', { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error('Không tải được dữ liệu demo');
        return response.json();
      })
      .then((data: DemoBundle) => setBundle(data))
      .catch((reason) => {
        if (reason.name !== 'AbortError') setError(true);
      });
    // Hủy yêu cầu khi rời màn hình để không ghi dữ liệu vào component đã đóng.
    return () => controller.abort();
  }, []);

  return { bundle, error };
}
