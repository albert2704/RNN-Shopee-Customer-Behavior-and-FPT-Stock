import type { DemoDataset } from '../../demoTypes.ts';

export interface InputReadout {
  timestamp: string;
  featureCount: number;
  items: { label: string; value: number | null; unit: string; digits: number }[];
  extra: string;
  preprocessing: string;
}

/**
 * Số dễ đọc từ đúng quan sát hiện tại, trước chuẩn hóa.
 * Đây chỉ là cách trình bày; không sửa vector normalizedInput của mô hình.
 */
export function getInputReadout(data: DemoDataset, read: number): InputReadout {
  const completed = Number.isFinite(read) ? Math.floor(read) : 0;
  // Chưa đọc thì không truy cập bất kỳ quan sát hay nhãn tương lai nào.
  const point =
    completed > 0
      ? data.context[Math.min(completed, data.lookback, data.context.length) - 1]
      : undefined;
  const timestamp = point ? `${point.timestamp.slice(8, 10)}/${point.timestamp.slice(5, 7)}` : '';

  function valueOf(feature: string, transform = (value: number) => value) {
    const index = data.featureNames.indexOf(feature);
    const value = point?.input[index];
    return value !== undefined && Number.isFinite(value) ? transform(value) : null;
  }

  const common = { timestamp, featureCount: data.featureNames.length };
  if (data.id === 'shopee') {
    // input chứa log1p(count); expm1 và làm tròn khôi phục số đếm để đọc.
    const count = (feature: string) => valueOf(feature, (value) => Math.round(Math.expm1(value)));
    return {
      ...common,
      items: [
        { label: 'Lượt truy cập', value: count('log_sessions'), unit: '', digits: 0 },
        { label: 'Thăm sản phẩm', value: count('log_product_visits'), unit: '', digits: 0 },
        { label: 'Thăm giỏ hàng', value: count('log_cart_visits'), unit: '', digits: 0 },
        { label: 'Thăm thanh toán', value: count('log_checkout_visits'), unit: '', digits: 0 },
        { label: 'Đơn hàng', value: count('log_orders'), unit: '', digits: 0 },
      ],
      extra: 'Lượt thăm giỏ không đồng nghĩa thêm sản phẩm vào giỏ.',
      preprocessing: 'Số đếm qua log1p; chuẩn hóa theo tập học.',
    };
  }
  return {
    ...common,
    items: [
      {
        label: 'Lợi suất log',
        value: valueOf('log_return', (value) => value * 100),
        unit: '%',
        digits: 3,
      },
    ],
    extra: '1 giá trị mỗi phiên',
    preprocessing: 'Chuẩn hóa theo trung bình và độ lệch chuẩn tập học.',
  };
}
