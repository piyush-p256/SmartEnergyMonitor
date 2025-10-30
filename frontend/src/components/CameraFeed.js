import { useRef, useEffect, useState } from 'react';
import Webcam from 'react-webcam';
import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Camera, CameraOff, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

const CameraFeed = ({ rooms, onOccupancyDetected, api }) => {
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);
  const [isActive, setIsActive] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState('');
  const [poseLandmarker, setPoseLandmarker] = useState(null);
  const [humanDetected, setHumanDetected] = useState(false);
  const [lastDetectionTime, setLastDetectionTime] = useState(null);
  const detectionIntervalRef = useRef(null);
  const noDetectionTimeoutRef = useRef(null);

  useEffect(() => {
    const loadModel = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/wasm'
        );
        const landmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
            delegate: 'GPU'
          },
          runningMode: 'VIDEO',
          numPoses: 5
        });
        setPoseLandmarker(landmarker);
      } catch (error) {
        console.error('Failed to load MediaPipe model:', error);
        toast.error('Failed to initialize human detection');
      }
    };

    loadModel();

    return () => {
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
      }
      if (noDetectionTimeoutRef.current) {
        clearTimeout(noDetectionTimeoutRef.current);
      }
    };
  }, []);

  const detectPose = async () => {
    if (!webcamRef.current?.video || !poseLandmarker || !canvasRef.current) {
      return;
    }

    const video = webcamRef.current.video;
    const canvas = canvasRef.current;

    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');

      try {
        const results = await poseLandmarker.detectForVideo(video, performance.now());
        
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (results.landmarks && results.landmarks.length > 0) {
          // Draw landmarks
          results.landmarks.forEach((landmarks) => {
            landmarks.forEach((landmark) => {
              ctx.beginPath();
              ctx.arc(
                landmark.x * canvas.width,
                landmark.y * canvas.height,
                5,
                0,
                2 * Math.PI
              );
              ctx.fillStyle = '#10b981';
              ctx.fill();
            });
          });

          // Human detected
          if (!humanDetected) {
            setHumanDetected(true);
            setLastDetectionTime(Date.now());
            if (selectedRoom) {
              onOccupancyDetected(selectedRoom, true);
            }
          }
          setLastDetectionTime(Date.now());

          // Clear any existing no-detection timeout
          if (noDetectionTimeoutRef.current) {
            clearTimeout(noDetectionTimeoutRef.current);
          }

          // Set timeout for no detection (5 minutes)
          noDetectionTimeoutRef.current = setTimeout(() => {
            setHumanDetected(false);
            if (selectedRoom) {
              onOccupancyDetected(selectedRoom, false);
              toast.info('No human detected for 5 minutes', {
                description: 'Room marked as unoccupied'
              });
            }
          }, 300000); // 5 minutes
        }
      } catch (error) {
        console.error('Detection error:', error);
      }
    }
  };

  const startDetection = () => {
    if (!selectedRoom) {
      toast.error('Please select a room first');
      return;
    }
    setIsActive(true);
    detectionIntervalRef.current = setInterval(detectPose, 100); // Check every 100ms
  };

  const stopDetection = () => {
    setIsActive(false);
    setHumanDetected(false);
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
    }
    if (noDetectionTimeoutRef.current) {
      clearTimeout(noDetectionTimeoutRef.current);
    }
  };

  return (
    <div className="space-y-6">
      {rooms.length === 0 ? (
        <Card className="p-8 text-center">
          <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-600">No rooms with camera enabled</p>
          <p className="text-sm text-slate-500 mt-2">Add a room and enable camera to start detection</p>
        </Card>
      ) : (
        <>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Select value={selectedRoom} onValueChange={setSelectedRoom}>
                <SelectTrigger data-testid="camera-room-select">
                  <SelectValue placeholder="Select room for camera detection" />
                </SelectTrigger>
                <SelectContent>
                  {rooms.map((room) => (
                    <SelectItem key={room.id} value={room.id}>
                      {room.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={isActive ? stopDetection : startDetection}
              className={`flex items-center gap-2 ${
                isActive
                  ? 'bg-red-500 hover:bg-red-600'
                  : 'bg-gradient-to-r from-cyan-500 to-blue-500'
              }`}
              data-testid="toggle-camera-btn"
            >
              {isActive ? (
                <>
                  <CameraOff className="w-4 h-4" />
                  Stop Detection
                </>
              ) : (
                <>
                  <Camera className="w-4 h-4" />
                  Start Detection
                </>
              )}
            </Button>
          </div>

          <div className="relative">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="relative rounded-lg overflow-hidden bg-slate-900">
                <Webcam
                  ref={webcamRef}
                  audio={false}
                  screenshotFormat="image/jpeg"
                  videoConstraints={{
                    width: 640,
                    height: 480,
                    facingMode: 'user'
                  }}
                  className="w-full h-auto"
                />
                {!isActive && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <p className="text-white text-lg">Camera Inactive</p>
                  </div>
                )}
              </div>

              <div className="relative rounded-lg overflow-hidden bg-slate-900">
                <canvas
                  ref={canvasRef}
                  className="w-full h-auto"
                />
                {!isActive && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <p className="text-white text-lg">Detection Preview</p>
                  </div>
                )}
              </div>
            </div>

            {isActive && (
              <div className="mt-4 p-4 rounded-lg bg-white border border-slate-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${
                      humanDetected ? 'bg-green-500 animate-pulse-slow' : 'bg-red-500'
                    }`}></div>
                    <span className="font-semibold text-slate-800">
                      {humanDetected ? 'Human Detected' : 'No Human Detected'}
                    </span>
                  </div>
                  {lastDetectionTime && (
                    <span className="text-sm text-slate-600">
                      Last seen: {new Date(lastDetectionTime).toLocaleTimeString()}
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-500 mt-2">
                  Room will be marked as unoccupied after 5 minutes of no detection
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default CameraFeed;
