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
    "shopee": dict(title="Shopee Thailand", subtitle="Hành vi khách hàng · dữ liệu mô phỏng", unit="đơn hàng / ngày", frequency="Theo ngày nguồn · múi giờ không xác định", label="Hnin Shwe Zin Hlaing · Kaggle · mô phỏng", license="CC BY-SA 4.0",
        description="Tổng hợp lượt truy cập, thăm trang sản phẩm, giỏ hàng, thanh toán và số đơn theo ngày. Học từ 30 ngày đã kết thúc để dự báo số đơn ngày tiếp theo.",
        cleaning=["Kiểm tra ID duy nhất, liên kết trang với session và ngày đơn với session.", "Tổng hợp 1.461 ngày trong 2022–2025; lượt thăm trang ngày 01/01/2026 không thuộc khoảng mục tiêu đầy đủ.", "Giữ session không mua và các cột marketing trống; chúng không phải đầu vào.", "Dùng log1p cho 5 số đếm; chuẩn hóa chỉ fit trên train. Không dùng ngày đích trong cửa sổ."],
        limitations=["100% dữ liệu mô phỏng Shopee Thailand, không phải dữ liệu chính thức hoặc thị trường Việt Nam.", "Thăm trang giỏ không đồng nghĩa thêm sản phẩm vào giỏ.", "Dự báo tổng số đơn toàn hệ thống, không dự báo một khách cụ thể.", "Nguồn không ghi múi giờ. Giữ ngày nguồn; không đổi múi giờ khi tổng hợp.", "MSE trên log1p và nghịch biến đổi không bảo đảm tối ưu MAE trong không gian số đơn."],
        insight="RNN và GRU có MAE cao hơn cách đoán như hôm trước; RMSE thấp hơn một chút. Đây là kết quả của một seed và một lần chia trên dữ liệu mô phỏng."),
    "fpt": dict(title="FPT",subtitle="Giá cổ phiếu FPT tại Việt Nam",unit="VND / cổ phiếu",frequency="Mỗi phiên giao dịch",label="Thang Tran · Kaggle",license="CC0: Public Domain",
        description="Học từ 30 lợi suất log quá khứ để dự báo lợi suất phiên tiếp theo, sau đó quy đổi về giá đóng cửa FPT bằng giá quan sát gần nhất.",
        cleaning=["Đọc TradingDate theo ngày/tháng/năm; loại 87 dòng trùng hoàn toàn và 1 dòng trùng ngày/OHLCV chỉ khác Value, còn 2.618 phiên.","Giữ lịch phiên giao dịch gốc, không tạo giá cho cuối tuần hoặc ngày nghỉ.","Bỏ phiên đầu vì chưa có lợi suất so với phiên trước, còn 2.617 lợi suất.","Time trống không dùng; kiểm tra các cột ngày, mã FPT và OHLCV. Chuẩn hóa chỉ fit trên train."],
        limitations=["Dữ liệu lịch sử từ 02/01/2013 đến 30/06/2023, không phải giá trực tiếp.","Nguồn chỉ có Close, không có Adj Close và không mô tả phương pháp điều chỉnh. Biến động lớn có thể bao gồm tác động của sự kiện doanh nghiệp.","Chỉ một seed và một lần chia theo thời gian; cần so sánh với cách giữ giá phiên trước.","MAE/RMSE theo VND không thể so trực tiếp với số đơn Shopee Thailand."],
        insight="Đánh giá RNN và GRU bằng MAE/RMSE trên cùng các phiên test, so với giá phiên trước; đường giá sát thực tế chưa chứng minh lợi thế dự báo."),

}


def downsample(frame, limit):
    if len(frame) <= limit:
        return frame.copy()
    return frame.iloc[np.linspace(0,len(frame)-1,limit,dtype=int)].copy()


def export(name):
    if name not in COPY:
        raise ValueError(f"Unsupported dataset: {name}. Choose shopee or fpt.")
    base = MODELS
    meta = json.loads((base / f"results/{name}/manifest.json").read_text())
    audit = meta["audit"]
    frame = pd.read_csv(base / meta["prepared_series_file"])
    frame.timestamp = pd.to_datetime(frame.timestamp)
    copy = COPY[name]
    splits = meta["splits"]
    summary = dict(rows=audit["series_rows"],rawRows=audit["raw_rows"],period=[audit["first_timestamp"],audit["last_timestamp"]],features=meta["features"],featureCount=len(meta["features"]),minimum=audit["target_min"],maximum=audit["target_max"],mean=audit["target_mean"])
    if name == "shopee":
        summary.update(rawSessionRows=audit["raw_session_rows"],rawActivityRows=audit["raw_activity_rows"],aggregateCounts=audit["aggregate_counts"],synthetic=True)
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
    for name in sys.argv[1:] or ["shopee","fpt"]:
        export(name)
