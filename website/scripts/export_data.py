#!/usr/bin/env python3
"""Export measured A6 results into small browser-safe, aggregate-only JSON assets."""
from pathlib import Path
import json
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
MODELS = ROOT.parent / "models"
OUT = ROOT / "public/data"

COPY = {
    "retailrocket": dict(title="Retailrocket",subtitle="Hành vi khách hàng",unit="sự kiện giao dịch / giờ",frequency="Theo giờ · UTC",label="Retailrocket · Kaggle",license="CC BY-NC-SA 4.0",
        description="Từ các lượt xem, thêm vào giỏ và giao dịch, tổng hợp hành vi theo giờ rồi dự báo số sự kiện giao dịch của giờ tiếp theo.",
        cleaning=["Loại 460 dòng trùng hoàn toàn; giữ các hành động lặp khác nhau.","Bỏ hai ngày UTC ở biên vì chưa đủ 24 giờ; tổng hợp thành 3.288 giờ.","Mã giao dịch trống ở lượt xem/thêm giỏ là bình thường, không loại các sự kiện này.","Dùng log1p cho số sự kiện; chuẩn hóa bằng dữ liệu train."],
        limitations=["Dự báo hành vi tổng hợp, không dự báo một khách hàng cụ thể.","Sự kiện giao dịch không đồng nghĩa số đơn hàng hay doanh thu.","Chỉ khoảng 4,5 tháng dữ liệu; giờ không ghi nhận có thể là lỗi logging.","Nghịch biến đổi log1p không bảo đảm cho kỳ vọng số đếm trong không gian gốc."],
        insight="RNN giảm sai số so với việc lặp lại giờ trước; thêm cổng GRU chưa cải thiện trên lần chia này."),
    "amazon": dict(title="Amazon",subtitle="Giá cổ phiếu AMZN",unit="USD / cổ phiếu điều chỉnh",frequency="Mỗi phiên giao dịch",label="Henry Shan · Kaggle",license="Apache 2.0",
        description="Học từ 30 lợi suất log quá khứ để dự báo lợi suất phiên tiếp theo, sau đó quy đổi về giá đóng cửa điều chỉnh bằng giá quan sát gần nhất.",
        cleaning=["Sắp xếp theo ngày; kiểm tra trùng và thiếu dữ liệu.","Giữ lịch phiên giao dịch gốc, không tạo giá cho cuối tuần hoặc ngày nghỉ.","Bỏ dòng đầu vì chưa có lợi suất so với phiên trước, còn 6.683 phiên.","Dùng lợi suất log thay cho mức giá; mọi thống kê chuẩn hóa chỉ fit trên train."],
        limitations=["Dữ liệu lịch sử kết thúc ngày 05/12/2023, không phải giá trực tiếp.","Adjusted Close dùng điều chỉnh hồi cứu từ nguồn; đây không phải backtest giao dịch point-in-time.","RNN/GRU không vượt rõ rệt baseline giữ nguyên giá gần nhất.","MAE/RMSE theo USD không thể so trực tiếp với Retailrocket vì khác đơn vị."],
        insight="Baseline giữ giá phiên trước có RMSE tốt nhất. Đường dự báo sát giá chưa chứng minh mô hình có khả năng dự báo lợi suất."),
}


def downsample(frame, limit):
    if len(frame) <= limit:
        return frame.copy()
    return frame.iloc[np.linspace(0,len(frame)-1,limit,dtype=int)].copy()


def export(name):
    if name not in COPY:
        raise ValueError(f"Unsupported dataset: {name}. Choose retailrocket or amazon.")
    base = MODELS
    meta = json.loads((base / f"results/{name}/manifest.json").read_text())
    audit = meta["audit"]
    frame = pd.read_csv(base / meta["prepared_series_file"])
    frame.timestamp = pd.to_datetime(frame.timestamp)
    copy = COPY[name]
    splits = meta["splits"]
    summary = dict(rows=audit["series_rows"],rawRows=audit["raw_rows"],period=[audit["first_timestamp"],audit["last_timestamp"]],features=meta["features"],featureCount=len(meta["features"]),minimum=audit["target_min"],maximum=audit["target_max"],mean=audit["target_mean"])
    if name == "retailrocket":
        summary.update(cleanEventRows=audit["clean_event_rows"],eventCounts=audit["event_counts_after_cleaning"])
    protocol = dict(lookback=meta["lookback"],train={"n":splits["train"]["n"],"start":splits["train"]["first_timestamp"],"end":splits["train"]["last_timestamp"]},
        validation={"n":splits["validation"]["n"],"start":splits["validation"]["first_timestamp"],"end":splits["validation"]["last_timestamp"]},
        test={"n":splits["test"]["n"],"start":splits["test"]["first_timestamp"],"end":splits["test"]["last_timestamp"]},policy=meta["evaluation_policy"],target=meta["prediction_task"],transform=meta["target_transform"],loss="MSE trên mục tiêu đã biến đổi và chuẩn hóa",seed=42,hiddenSize=32,splitFractions=[.70,.15,.15])
    predictions = {}
    metrics = []
    for kind, result in meta["models"].items():
        p = pd.read_csv(base / result["predictions_file"])
        p = p[p.split == "test"].reset_index(drop=True)
        p.timestamp = pd.to_datetime(p.timestamp).map(lambda t:t.isoformat())
        predictions[kind] = p
        mae=float(np.abs(p.actual-p.predicted).mean())
        rmse=float(np.sqrt(np.square(p.actual-p.predicted).mean()))
        np.testing.assert_allclose([mae,rmse],[result["metrics"]["test"]["MAE"],result["metrics"]["test"]["RMSE"]],rtol=1e-7)
        metrics.append(dict(model=kind,mae=mae,rmse=rmse))
    sample = predictions["rnn"][["timestamp","actual","split"]].copy()
    for kind,p in predictions.items():
        assert (p.timestamp == sample.timestamp).all()
        np.testing.assert_array_equal(p.actual,sample.actual)
        sample[kind]=p.predicted
    full_count=len(sample)
    sample=downsample(sample,1000)
    overview=frame[["timestamp","target"]].rename(columns={"target":"actual"}).copy()
    def split_of(i):
        if i < splits["train"]["first_target_index"]:return "context"
        if i <= splits["train"]["last_target_index"]:return "train"
        if i <= splits["validation"]["last_target_index"]:return "validation"
        return "test"
    overview["split"]=[split_of(i) for i in range(len(frame))]
    overview=downsample(overview,700)
    overview.timestamp=overview.timestamp.map(lambda t:t.isoformat())
    history,models={},{}
    for kind in ["rnn","gru"]:
        model=meta["models"][kind]
        h=pd.read_csv(base/model["history_file"]).rename(columns={"train_loss":"train","validation_loss":"validation"})
        history[kind]=h.to_dict(orient="records")
        models[kind]=dict(bestEpoch=model["best_epoch"],epochsRun=model["epochs_run"],parameters=model["parameters"],checkpointSha256=model["checkpoint_sha256"])
    result=dict(id=name,title=copy["title"],subtitle=copy["subtitle"],source=dict(label=copy["label"],url=audit["source_url"],license=copy["license"],sha256=audit["source_sha256"]),unit=copy["unit"],frequency=copy["frequency"],summary=summary,description=copy["description"],cleaning=copy["cleaning"],protocol=protocol,metrics=metrics,series=sample.to_dict(orient="records"),overviewSeries=overview.to_dict(orient="records"),history=history,models=models,limitations=copy["limitations"],insight=copy["insight"],display=dict(fullTestPointCount=full_count,displayedTestPointCount=len(sample),downsampleMethod="None; every test target is shown." if full_count <= 1000 else "1,000 evenly spaced indices, endpoints included; scores use every held-out target.",overviewMethod="At most 700 evenly spaced original observations; no averaging. Overview is descriptive only."))
    OUT.mkdir(parents=True,exist_ok=True)
    (OUT/f"{name}.json").write_text(json.dumps(result,ensure_ascii=False,separators=(",",":"),allow_nan=False))
    print(f"{name}: {len(sample)}/{full_count} test points; {len(overview)} overview points; {len(metrics)} evaluated models")


if __name__ == "__main__":
    import sys
    for name in sys.argv[1:] or ["retailrocket","amazon"]:
        export(name)
