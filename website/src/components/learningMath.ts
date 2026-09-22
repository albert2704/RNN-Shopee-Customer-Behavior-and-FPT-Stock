// Giữ đường dẫn import cũ cho LearningExample. Phép tính nằm trong domain
// để có thể đọc và kiểm tra độc lập với React và các component giao diện.
export {
  EXAMPLE_INPUT,
  EXAMPLE_TARGET,
  INITIAL_WEIGHTS,
  LEARNING_RATE,
  scalarForward,
  scalarGradient,
  scalarUpdate,
  type ScalarWeights,
} from '../domain/learning/scalarRnn.ts';
