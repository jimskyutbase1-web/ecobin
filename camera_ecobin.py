from pathlib import Path
import time
import cv2
import requests
import threading
import numpy as np


# ============================================================
# ECOBIN CAMERA CLIENT
# Laptop Camera -> Flask AI Server -> ESP32 -> Servo
# ============================================================

BASE_DIR = Path(__file__).resolve().parent

# ============================================================
# FLASK SERVER
# ============================================================

SERVER_URL = "http://127.0.0.1:5000"
CLASSIFY_URL = f"{SERVER_URL}/classify"


# ============================================================
# CAMERA SETTINGS
# ============================================================

CAMERA_INDEX = 0

# Send one image every 1 second.
# This prevents the ESP32 from receiving commands too quickly.
SEND_INTERVAL = 1.0

# IMPORTANT:
# This must match ecobin_server.py
MIN_CONFIDENCE = 0.60


# ============================================================
# OPEN CAMERA
# ============================================================

camera = cv2.VideoCapture(CAMERA_INDEX)

if not camera.isOpened():

    raise RuntimeError(
        "Could not open the laptop camera. "
        "Try CAMERA_INDEX = 1 if another camera is available."
    )


camera.set(
    cv2.CAP_PROP_FRAME_WIDTH,
    640
)

camera.set(
    cv2.CAP_PROP_FRAME_HEIGHT,
    480
)


# ============================================================
# START MESSAGE
# ============================================================

print()
print("=" * 60)
print("              ECOBIN CAMERA CLIENT")
print("=" * 60)

print("Camera: READY")
print("Flask server:", CLASSIFY_URL)
print("Minimum confidence:", MIN_CONFIDENCE * 100, "%")
print("Send interval:", SEND_INTERVAL, "second")
print()
print("Flow:")
print("Camera -> Flask AI -> ESP32 -> Servo")
print()
print("Press Q to quit.")
print()


# ============================================================
# VARIABLES
# ============================================================

last_send = 0

last_class = "-"
last_confidence = 0.0

last_message = "Waiting for AI..."

last_command_status = "NOT SENT"
is_sending = False
COOLDOWN_DURATION = 10.0
opening_until = 0.0
opening_waste_type = ""

ROI_X1 = 140
ROI_Y1 = 80
ROI_X2 = 500
ROI_Y2 = 400
PROXIMITY_MIN_AREA = 10000
avg_bg = None
bg_warmup = 25
object_detected = False
was_opening = False
SCAN_DURATION = 3.0
object_detected_start = None


def send_image_worker(frame_to_send):
    global last_class, last_confidence, last_message, last_command_status, is_sending, opening_until, opening_waste_type
    try:
        ok, encoded = cv2.imencode(
            ".jpg",
            frame_to_send,
            [
                cv2.IMWRITE_JPEG_QUALITY,
                85
            ]
        )

        if not ok:
            last_message = (
                "Could not encode image"
            )
            last_command_status = (
                "NOT SENT"
            )
            return

        files = {
            "image": (
                "camera.jpg",
                encoded.tobytes(),
                "image/jpeg"
            )
        }

        response = requests.post(
            CLASSIFY_URL,
            files=files,
            timeout=8
        )

        if response.status_code == 200:
            data = response.json()

            last_class = str(
                data.get(
                    "class",
                    "-"
                )
            )

            last_confidence = float(
                data.get(
                    "confidence",
                    0.0
                )
            )

            accepted = bool(
                data.get(
                    "accepted",
                    False
                )
            )

            command_sent = bool(
                data.get(
                    "command_sent",
                    False
                )
            )

            last_message = str(
                data.get(
                    "message",
                    "OK"
                )
            )

            print(
                f"AI: "
                f"{last_class.upper()} "
                f"{last_confidence * 100:.1f}%"
            )

            if command_sent:
                last_command_status = (
                    "COMMAND SENT"
                )
                opening_waste_type = last_class.upper()
                opening_until = time.time() + COOLDOWN_DURATION
                print(
                    "   -> ESP32: COMMAND SENT"
                )
                print(
                    f"   -> Waste type: "
                    f"{last_class.upper()}"
                )
                print(
                    f"   -> Server: "
                    f"{last_message}"
                )

            elif accepted:
                last_command_status = (
                    "NOT SENT"
                )
                print(
                    "   -> AI accepted, "
                    "but command was NOT sent"
                )
                print(
                    f"   -> Server: "
                    f"{last_message}"
                )

            else:
                last_command_status = (
                    "NOT SENT"
                )
                print(
                    "   -> NOT SENT"
                )
                print(
                    f"   -> Confidence below "
                    f"{MIN_CONFIDENCE * 100:.0f}%"
                )

            print()

        else:
            last_message = (
                f"Flask HTTP "
                f"{response.status_code}"
            )
            last_command_status = (
                "SERVER ERROR"
            )
            print()
            print(
                "FLASK SERVER ERROR"
            )
            print(
                "HTTP status:",
                response.status_code
            )
            print(
                "Response:",
                response.text
            )
            print()

    except requests.exceptions.ConnectionError:
        last_message = (
            "Flask server OFFLINE"
        )
        last_command_status = (
            "SERVER OFFLINE"
        )
        print(
            "ERROR: Flask server is offline."
        )

    except requests.exceptions.Timeout:
        last_message = (
            "Flask server TIMEOUT"
        )
        last_command_status = (
            "TIMEOUT"
        )
        print(
            "ERROR: Flask server timeout."
        )

    except Exception as e:
        last_message = (
            f"Error: {e}"
        )
        last_command_status = (
            "ERROR"
        )
        print(
            "ERROR:",
            e
        )

    finally:
        is_sending = False


# ============================================================
# MAIN CAMERA LOOP
# ============================================================

while True:

    success, frame = camera.read()

    if not success:

        print(
            "Could not read frame from camera."
        )

        break


    roi = frame[ROI_Y1:ROI_Y2, ROI_X1:ROI_X2]
    gray_roi = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
    gray_roi = cv2.GaussianBlur(gray_roi, (21, 21), 0)

    if avg_bg is None or bg_warmup > 0:
        if avg_bg is None:
            avg_bg = gray_roi.copy().astype("float")
        else:
            cv2.accumulateWeighted(gray_roi, avg_bg, 0.2)
        bg_warmup -= 1
        object_detected = False
    else:
        diff = cv2.absdiff(gray_roi, cv2.convertScaleAbs(avg_bg))
        _, thresh = cv2.threshold(diff, 25, 255, cv2.THRESH_BINARY)
        thresh = cv2.dilate(thresh, None, iterations=2)
        contours, _ = cv2.findContours(
            thresh,
            cv2.RETR_EXTERNAL,
            cv2.CHAIN_APPROX_SIMPLE
        )

        max_contour_area = 0
        for c in contours:
            area = cv2.contourArea(c)
            if area > max_contour_area:
                max_contour_area = area

        object_detected = max_contour_area >= PROXIMITY_MIN_AREA

        if not object_detected:
            cv2.accumulateWeighted(gray_roi, avg_bg, 0.05)

    now = time.time()

    if now < opening_until:
        was_opening = True
    elif was_opening:
        was_opening = False
        last_class = "-"
        last_confidence = 0.0
        last_message = "Waiting for AI..."
        last_command_status = "NOT SENT"
        opening_waste_type = ""
        avg_bg = None
        bg_warmup = 25
        object_detected = False
        object_detected_start = None
        last_send = now
        print("=" * 60)
        print("          SCANNER RESTARTED - READY FOR OBJECT")
        print("=" * 60)
        print()

    if object_detected and (now >= opening_until):
        if object_detected_start is None:
            object_detected_start = now
        held_duration = now - object_detected_start
        scan_progress = min(1.0, held_duration / SCAN_DURATION)
        scan_ready = held_duration >= SCAN_DURATION
    else:
        object_detected_start = None
        scan_progress = 0.0
        scan_ready = False


    # ========================================================
    # SEND IMAGE TO FLASK
    # ========================================================

    if (now >= opening_until) and scan_ready and (now - last_send >= SEND_INTERVAL) and not is_sending:

        last_send = now
        is_sending = True
        object_detected_start = None

        threading.Thread(
            target=send_image_worker,
            args=(frame.copy(),),
            daemon=True
        ).start()


    # ============================================================
    # CAMERA DISPLAY
    # ============================================================

    if now < opening_until:

        remaining = int(opening_until - now) + 1
        display_frame = np.zeros((480, 640, 3), dtype=np.uint8)
        display_frame[:] = (20, 25, 30)

        cv2.rectangle(
            display_frame,
            (40, 40),
            (600, 440),
            (45, 50, 60),
            -1
        )
        cv2.rectangle(
            display_frame,
            (40, 40),
            (600, 440),
            (0, 255, 0),
            2
        )

        cv2.putText(
            display_frame,
            "TRASH BIN OPENING",
            (85, 130),
            cv2.FONT_HERSHEY_SIMPLEX,
            1.1,
            (0, 255, 0),
            3
        )
        cv2.putText(
            display_frame,
            f"CLASSIFIED: {opening_waste_type}",
            (85, 200),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.9,
            (0, 255, 255),
            2
        )
        cv2.putText(
            display_frame,
            "Please deposit waste into the bin",
            (85, 260),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.7,
            (255, 255, 255),
            2
        )
        cv2.putText(
            display_frame,
            f"Resuming camera feed in: {remaining}s",
            (85, 320),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.75,
            (100, 200, 255),
            2
        )
        cv2.putText(
            display_frame,
            "Q = Quit",
            (85, 400),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.6,
            (180, 180, 180),
            2
        )

        cv2.imshow(
            "ECOBIN - Live Waste Classification",
            display_frame
        )

    else:

        box_color = (0, 255, 0) if scan_ready else ((0, 255, 255) if object_detected else (0, 165, 255))
        cv2.rectangle(
            frame,
            (ROI_X1, ROI_Y1),
            (ROI_X2, ROI_Y2),
            box_color,
            2
        )

        if scan_ready:
            zone_label = "OBJECT SCANNED - CLASSIFYING"
        elif object_detected:
            zone_label = f"SCANNING... {int(scan_progress * 100)}%"
        else:
            zone_label = "HOLD OBJECT HERE"

        cv2.putText(
            frame,
            zone_label,
            (ROI_X1, ROI_Y1 - 10),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.6,
            box_color,
            2
        )

        if object_detected:
            bar_y = ROI_Y2 + 10
            fill_w = int((ROI_X2 - ROI_X1) * scan_progress)
            cv2.rectangle(
                frame,
                (ROI_X1, bar_y),
                (ROI_X2, bar_y + 12),
                (40, 40, 40),
                -1
            )
            cv2.rectangle(
                frame,
                (ROI_X1, bar_y),
                (ROI_X1 + fill_w, bar_y + 12),
                (0, 255, 0) if scan_ready else (0, 255, 255),
                -1
            )
            cv2.rectangle(
                frame,
                (ROI_X1, bar_y),
                (ROI_X2, bar_y + 12),
                (200, 200, 200),
                1
            )

        if scan_ready or last_class != "-":
            title = (
                f"{last_class.upper()} "
                f"{last_confidence * 100:.1f}%"
            )
            server_display = f"Server: {last_message}"
            status_display = f"ESP32: {last_command_status}"
        elif object_detected:
            title = f"SCANNING OBJECT ({int(scan_progress * 100)}%)"
            server_display = "Hold object steady in detection box..."
            status_display = "ESP32: WAITING"
        else:
            title = "WAITING FOR OBJECT"
            server_display = "Hold waste inside detection box"
            status_display = "ESP32: WAITING"

        cv2.putText(
            frame,
            title,
            (20, 40),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.9,
            (0, 255, 0) if scan_ready else ((0, 255, 255) if object_detected else (0, 165, 255)),
            2
        )

        cv2.putText(
            frame,
            server_display,
            (20, 80),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.55,
            (255, 255, 255),
            2
        )

        cv2.putText(
            frame,
            status_display,
            (20, 115),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.65,
            (0, 255, 255),
            2
        )

        cv2.putText(
            frame,
            "Camera -> Flask -> ESP32 -> Servo",
            (20, 150),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.55,
            (255, 255, 255),
            2
        )

        cv2.putText(
            frame,
            "Q = Quit | R = Reset Sensor",
            (20, 460),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.6,
            (255, 255, 255),
            2
        )

        cv2.imshow(
            "ECOBIN - Live Waste Classification",
            frame
        )


    # ============================================================
    # QUIT
    # ============================================================

    key = cv2.waitKey(1) & 0xFF
    if key == ord("q"):

        break

    elif key == ord("r"):

        avg_bg = None
        bg_warmup = 25
        object_detected_start = None


# ============================================================
# CLEANUP
# ============================================================

camera.release()

cv2.destroyAllWindows()


print()
print("=" * 60)
print("          ECOBIN CAMERA STOPPED")
print("=" * 60)