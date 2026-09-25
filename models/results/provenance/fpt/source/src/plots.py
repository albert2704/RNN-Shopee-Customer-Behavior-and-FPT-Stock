"""Biểu đồ dữ liệu, quá trình học, dự báo, phần dư và MAE/RMSE."""

import numpy as np
import pandas as pd


def plot_dataset(name, frame, meta, *, root):
    """Vẽ EDA và kết quả đã lưu; EDA toàn chuỗi chỉ dùng để mô tả.

    Hàm không chọn checkpoint hay điều chỉnh mô hình bằng các biểu đồ test.
    """
    import matplotlib

    matplotlib.use("Agg")
    """Vẽ EDA và kết quả đã lưu; EDA toàn chuỗi chỉ dùng để mô tả.

    Hàm không chọn checkpoint hay điều chỉnh mô hình bằng các biểu đồ test.
    """
    import matplotlib.pyplot as plt

    plt.rcParams.update(
        {
            "font.size": 10,
            "axes.spines.top": False,
            "axes.spines.right": False,
            "savefig.dpi": 160,
            "axes.titleweight": "bold",
            "figure.facecolor": "white",
        }
    )
    folder = root / "figures"
    folder.mkdir(parents=True, exist_ok=True)
    colors = dict(
        rnn="#2864BA",
        gru="#CC5137",
        persistence="#747C86",
        seasonal="#739B43",
        train_mean="#739B43",
    )

    def shade(ax):
        for split, color in [("validation", "#f2d7ac"), ("test", "#c9e4e7")]:
            s = meta["splits"][split]
            ax.axvspan(
                pd.Timestamp(s["first_timestamp"]),
                pd.Timestamp(s["last_timestamp"]),
                color=color,
                alpha=0.6,
                label=split.title(),
            )

    fig, axes = plt.subplots(2, 1, figsize=(11, 7.3), layout="constrained")
    if name == "retailrocket":
        daily = frame[["view", "addtocart", "transaction"]].resample("D").sum()
        for col in daily:
            axes[0].plot(daily.index, daily[col], label=col, lw=1.3)
        axes[0].set(
            yscale="log",
            ylabel="Observed events per day (log scale)",
            title="Retailrocket: recorded customer actions over time",
        )
        shade(axes[0])
        axes[0].legend(ncol=5, fontsize=8)
        hourly = frame.groupby(frame.index.hour).transaction.mean()
        axes[1].bar(hourly.index, hourly.values, color="#2864BA")
        axes[1].set(
            xlabel="Hour of day (UTC)",
            ylabel="Mean transaction events / hour",
            title="Descriptive hourly profile across the full series (EDA only)",
            xticks=np.arange(0, 24, 2),
        )
    else:
        axes[0].plot(frame.index, frame.target, color="#243A57", lw=1)
        shade(axes[0])
        axes[0].legend()
        axes[0].set(
            ylabel="Closing price (VND)",
            title="FPT: historical source closing price",
        )
        axes[1].plot(frame.index, frame.log_return * 100, color="#2864BA", lw=0.5)
        axes[1].set(
            ylabel="Session log return (%)",
            xlabel="Trading date",
            title="Log returns retain jumps and changing volatility",
        )
    fig.savefig(folder / f"{name}_eda.png")
    plt.close(fig)
    fig, ax = plt.subplots(figsize=(10, 4.7), layout="constrained")
    for kind in ["rnn", "gru"]:
        history = pd.read_csv(root / meta["models"][kind]["history_file"])
        ax.plot(
            history.epoch,
            history.train_loss,
            color=colors[kind],
            label=f"{kind.upper()} training",
        )
        ax.plot(
            history.epoch,
            history.validation_loss,
            color=colors[kind],
            ls="--",
            label=f"{kind.upper()} validation",
        )
        epoch = meta["models"][kind]["best_epoch"]
        ax.scatter(
            [epoch],
            [history.loc[history.epoch == epoch, "validation_loss"].iloc[0]],
            color=colors[kind],
            s=55,
            zorder=5,
        )
    ax.set(
        xlabel="Epoch",
        ylabel="MSE on standardized transformed target",
        title=f"{name.title()}: learning curves; dots mark selected checkpoints",
    )
    ax.legend(ncol=2)
    fig.savefig(folder / f"{name}_loss.png")
    plt.close(fig)
    predictions = {
        kind: pd.read_csv(
            root / result["predictions_file"], parse_dates=["timestamp"]
        ).query("split == 'test'")
        for kind, result in meta["models"].items()
    }
    primary = predictions["rnn"]
    fig, axes = plt.subplots(2, 1, figsize=(11, 7.6), layout="constrained")
    for ax, subset, title in [
        (axes[0], slice(None), "Entire held-out test period"),
        (
            axes[1],
            slice(-168 if name == "retailrocket" else -90, None),
            "Final 7 days" if name == "retailrocket" else "Final 90 trading sessions",
        ),
    ]:
        part = primary.iloc[subset]
        ax.plot(part.timestamp, part.actual, color="#142338", lw=1.8, label="Observed")
        for kind, pred in predictions.items():
            p = pred.iloc[subset]
            ax.plot(
                p.timestamp,
                p.predicted,
                label=(
                    kind.upper() if kind in ["rnn", "gru"] else kind.replace("_", " ")
                ),
                color=colors[kind],
                alpha=0.85,
                lw=1,
            )
        ax.set(title=title, ylabel=meta["target_unit"], xlabel="Target timestamp")
        ax.legend(ncol=len(predictions) + 1, fontsize=8)
    fig.suptitle(
        f"{name.title()}: one-step forecasts using observed history", weight="bold"
    )
    fig.savefig(folder / f"{name}_predictions.png")
    plt.close(fig)
    fig, axes = plt.subplots(1, 2, figsize=(11, 4.5), layout="constrained")
    for kind in ["rnn", "gru"]:
        p = predictions[kind]
        residual = p.actual - p.predicted
        axes[0].plot(
            p.timestamp,
            residual,
            color=colors[kind],
            alpha=0.7,
            lw=0.8,
            label=kind.upper(),
        )
        axes[1].hist(
            residual, bins=35, alpha=0.5, color=colors[kind], label=kind.upper()
        )
    axes[0].axhline(0, color="black", lw=0.8)
    axes[0].set(
        title="Test residuals: observed minus forecast",
        ylabel=meta["target_unit"],
        xlabel="Target timestamp",
    )
    axes[0].tick_params(axis="x", rotation=25)
    axes[0].legend()
    axes[1].set(
        title="Residual distribution",
        xlabel=meta["target_unit"],
        ylabel="Test observations",
    )
    axes[1].legend()
    fig.savefig(folder / f"{name}_residuals.png")
    plt.close(fig)
    fig, axes = plt.subplots(1, 2, figsize=(10, 4.7), layout="constrained")
    kinds = list(meta["models"])
    for ax, metric in zip(axes, ["MAE", "RMSE"]):
        vals = [meta["models"][k]["metrics"]["test"][metric] for k in kinds]
        bars = ax.bar(
            [k.upper() if k in ["rnn", "gru"] else k.replace("_", " ") for k in kinds],
            vals,
            color=[colors[k] for k in kinds],
        )
        ax.bar_label(bars, fmt="%.3f", padding=4, fontsize=9)
        ax.set(
            title=f"Test {metric} (lower is better)",
            ylabel=meta["target_unit"],
            ylim=(0, max(vals) * 1.18),
        )
    fig.suptitle(
        f"{name.title()}: same target dates for all comparisons", weight="bold"
    )
    fig.savefig(folder / f"{name}_metrics.png")
    plt.close(fig)
