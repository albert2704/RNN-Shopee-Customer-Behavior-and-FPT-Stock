import type { DemoDataset, DemoDatasetId } from '../../demoTypes';
import { formatNumber } from '../../types';
import type { DemoPhase } from './replayTimeline';

/** Nội dung dẫn chuyện, tách khỏi phép tính và bộ điều khiển thời gian. */
export const DATASET_COPY: Record<
  DemoDatasetId,
  {
    name: string;
    subject: string;
    question: string;
    inputDescription: string;
    caseTakeaway: string;
    baselineLabel: string;
    baselineExplanation: string;
  }
> = {
  retailrocket: {
    name: 'Retailrocket',
    baselineLabel: 'Đoán như giờ trước',
    baselineExplanation: 'Lấy số giao dịch giờ trước để đoán giờ tới.',
    subject: 'Hành vi khách hàng',
    question: 'Giờ tới có bao nhiêu sự kiện giao dịch?',
    inputDescription: '24 giờ: lượt xem, thêm vào giỏ, giao dịch và thời gian.',
    caseTakeaway: 'Thực tế tăng lên 13 sự kiện. RNN dự đoán thấp và bỏ lỡ mức tăng này.',
  },
  amazon: {
    name: 'Amazon',
    baselineLabel: 'Đoán như phiên trước',
    baselineExplanation: 'Lấy giá phiên trước để đoán phiên tới.',
    subject: 'Chứng khoán',
    question: 'Giá điều chỉnh phiên tới là bao nhiêu?',
    inputDescription: '30 phiên: mức thay đổi giá theo log. Biểu đồ hiển thị giá USD.',
    caseTakeaway: 'Ở phiên này, RNN gần thực tế hơn cách giữ nguyên giá phiên trước.',
  },
};

// Nhận xét ví dụ ở trên gắn với mẫu test đầu tiên đã kiểm chứng trong demo.json.
// Nếu thay mẫu xuất ra, cần kiểm tra lại nhận xét; không suy từ một mẫu sang toàn test.
export const PHASE_LABELS = ['Đọc chuỗi', 'Dự đoán', 'Thực tế', 'Toàn tập'] as const;

/** Linear tạo số đã chuẩn hóa; bước hoàn nguyên mới tạo đơn vị trên biểu đồ. */
export const OUTPUT_COPY: Record<DemoDatasetId, { conversion: string; explanation: string }> = {
  retailrocket: {
    conversion: 'Đổi về số sự kiện',
    explanation: 'Bỏ chuẩn hóa → hoàn tác log(1 + x) → chặn giá trị âm về 0.',
  },
  amazon: {
    conversion: 'Đổi thành giá USD',
    explanation: 'Bỏ chuẩn hóa → lợi suất log → nhân giá cuối với exp(lợi suất).',
  },
};
export const formatAmount = (data: DemoDataset, value: number) =>
  `${formatNumber(value, 2)} ${data.unit}`;

export function timeLabel(data: DemoDataset, timestamp: string) {
  return data.id === 'amazon'
    ? `${timestamp.slice(8, 10)}/${timestamp.slice(5, 7)}`
    : timestamp.slice(11, 16);
}

/** So sánh MAE trên CÙNG tập và CÙNG đơn vị; không so USD với số sự kiện. */
export function compareText(data: DemoDataset) {
  if (data.metrics.rnnMae < data.metrics.baselineMae) {
    const improvement = (1 - data.metrics.rnnMae / data.metrics.baselineMae) * 100;
    return `RNN lệch ít hơn ${formatNumber(improvement, 1)}% so với cách ${DATASET_COPY[data.id].baselineLabel.toLowerCase()}.`;
  }
  return `RNN chưa tốt hơn cách ${DATASET_COPY[data.id].baselineLabel.toLowerCase()}.`;
}

/** Màu chỉ mã hóa dấu/độ lớn của h; không gán ý nghĩa “xu hướng” cho một ô. */
export function stateColor(value: number) {
  if (value === 0) return '#e2e8f0';
  const opacity = 0.2 + Math.abs(value) * 0.8;
  return value > 0 ? `rgba(54,94,235,${opacity})` : `rgba(170,114,67,${opacity})`;
}

interface CaptionContext {
  summary: boolean;
  begun: boolean;
  evaluated: boolean;
  playing: boolean;
  revealed: boolean;
  predicted: boolean;
  read: number;
}

/** Một câu dẫn theo pha; không đọc lại toàn bộ trạng thái 32 chiều ở mỗi nhịp. */
export function getCaption(state: CaptionContext) {
  if (state.summary) return 'Một mô hình cần được đánh giá trên nhiều mốc thời gian.';
  if (!state.begun) return 'Chạy tập đang chọn. Sau dự đoán, bấm để xem thực tế và toàn tập.';
  if (state.evaluated) {
    return 'Một ví dụ chưa đủ để kết luận. Hãy xem sai số trên toàn tập.';
  }
  if (state.revealed) return 'Bấm “Xem toàn tập” để đánh giá trên nhiều dự đoán.';
  if (state.predicted) return 'Đã có dự đoán. Bấm “Xem thực tế” khi sẵn sàng đối chiếu.';
  if (state.read === 1) return 'Bước 1: quan sát đầu tiên + trạng thái ban đầu → trạng thái mới.';
  if (state.read === 2)
    return 'Bước 2: dùng lại trạng thái vừa tính, kết hợp với quan sát thứ hai.';
  if (state.read) return 'Lặp lại cùng phép tính. Trạng thái thay đổi; trọng số giữ nguyên.';
  return 'Mỗi chuỗi bắt đầu với trạng thái bằng 0 và trọng số đã học.';
}

/** Thông báo số liệu cho trình đọc màn hình khi sang pha kết quả. */
export function getAnnouncement(
  data: DemoDataset,
  phase: DemoPhase,
  summary: boolean,
  caption: string,
) {
  if (summary) return caption;
  if (phase === 1) return `RNN dự đoán ${formatAmount(data, data.target.prediction)}.`;
  if (phase === 2) {
    return `Thực tế ${formatAmount(data, data.target.value)}. Sai số RNN ${formatAmount(data, data.target.absoluteError)}; giữ nguyên ${formatAmount(data, data.target.baselineAbsoluteError)}.`;
  }
  if (phase === 3) {
    return `Toàn tập kiểm tra: MAE RNN ${formatNumber(data.metrics.rnnMae, 4)} ${data.unit}, giữ nguyên ${formatNumber(data.metrics.baselineMae, 4)} ${data.unit}. ${compareText(data)}`;
  }
  return caption;
}
