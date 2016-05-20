SYSTEM_MODE(SEMI_AUTOMATIC);

#include <SparkFunLSM9DS1.h>
#include "math.h"

#define LSM9DS1_M	0x1E
#define LSM9DS1_AG	0x6B

// #define STATIC_IP

// http://www.ngdc.noaa.gov/geomag-web/#declination
#define DECLINATION -13.39

LSM9DS1 imu;
TCPServer server = TCPServer(80);
TCPClient client;
bool printedWifi;

void setup()
{
  Serial.begin(115200);

#if defined(STATIC_IP)
  // Set static IP
  IPAddress myAddress(192, 168, 1, 254);
  IPAddress gateway(192, 168, 1, 1);
  IPAddress dns(8, 8, 8, 8);
  IPAddress netmask(255, 255, 255, 0);
  WiFi.setStaticIP(myAddress, netmask, gateway, dns);

  // now let's use the configured IP
  WiFi.useStaticIP();
#endif

  WiFi.connect();
  Particle.connect();

  // Before initializing the IMU, there are a few settings
  // we may need to adjust. Use the settings struct to set
  // the device's communication mode and addresses:
  imu.settings.device.commInterface = IMU_MODE_I2C;
  imu.settings.device.mAddress = LSM9DS1_M;
  imu.settings.device.agAddress = LSM9DS1_AG;
  // The above lines will only take effect AFTER calling
  // imu.begin(), which verifies communication with the IMU
  // and turns it on.
  if (!imu.begin())
  {
    Serial.println("Failed to communicate with LSM9DS1.");
    Serial.println("Double-check wiring.");
    Serial.println("Default settings in this sketch will " \
                  "work for an out of the box LSM9DS1 " \
                  "Breakout, but may need to be modified " \
                  "if the board jumpers are.");
  }

  server.begin();

  Serial.println("Board initialized!");
}

void loop()
{
  if (WiFi.ready() && !printedWifi) printWifi();

  if (client.connected()) {
    imu.readGyro();
    imu.readAccel();
    imu.readMag();

    client.print("data: ");
    // gx,gy,gz,ax,ay,az,mx,my,mz,pitch,roll,heading
    client.print(imu.calcGyro(imu.gx), 2);
    client.print(",");
    client.print(imu.calcGyro(imu.gy), 2);
    client.print(",");
    client.print(imu.calcGyro(imu.gz), 2);
    client.print(",");

    client.print(imu.calcAccel(imu.ax), 2);
    client.print(",");
    client.print(imu.calcAccel(imu.ay), 2);
    client.print(",");
    client.print(imu.calcAccel(imu.az), 2);
    client.print(",");

    client.print(imu.calcMag(imu.mx), 2);
    client.print(",");
    client.print(imu.calcMag(imu.my), 2);
    client.print(",");
    client.print(imu.calcMag(imu.mz), 2);
    client.print(",");

    printAttitude(imu.ax, imu.ay, imu.az, -imu.my, -imu.mx, imu.mz);
    client.println();
    client.println();
    client.flush();
  } else {
    client = server.available();
    if (client) {
      Serial.print("New client connected at ");
      Serial.println(client.remoteIP().toString());
      serverSentEventHeader();
    }
  }
}

void printWifi() {
  if (!WiFi.localIP()) return;
  Particle.publish("telemetry-ip", WiFi.localIP().toString());
  Particle.publish("telemetry-ssid", WiFi.SSID());

  Serial.print("IP: ");
  Serial.println(WiFi.localIP().toString());
  Serial.print("SSID: ");
  Serial.println(WiFi.SSID());

  printedWifi = true;
}

// Calculate pitch, roll, and heading.
// Pitch/roll calculations take from this app note:
// http://cache.freescale.com/files/sensors/doc/app_note/AN3461.pdf?fpsp=1
// Heading calculations taken from this app note:
// http://www51.honeywell.com/aero/common/documents/myaerospacecatalog-documents/Defense_Brochures-documents/Magnetic__Literature_Application_notes-documents/AN203_Compass_Heading_Using_Magnetometers.pdf
void printAttitude(
float ax, float ay, float az, float mx, float my, float mz)
{
  float roll = atan2(ay, az);
  float pitch = atan2(-ax, sqrt(ay * ay + az * az));

  float heading;
  if (my == 0)
    heading = (mx < 0) ? 180.0 : 0;
  else
    heading = atan2(mx, my);

  heading -= DECLINATION * M_PI / 180;

  if (heading > M_PI) heading -= (2 * M_PI);
  else if (heading < -M_PI) heading += (2 * M_PI);
  else if (heading < 0) heading += 2 * M_PI;

  // Convert everything from radians to degrees:
  heading *= 180.0 / M_PI;
  pitch *= 180.0 / M_PI;
  roll  *= 180.0 / M_PI;

  client.print(pitch, 2);
  client.print(",");
  client.print(roll, 2);
  client.print(",");
  client.print(heading, 2);
}

void serverSentEventHeader() {
  client.println("HTTP/1.1 200 OK");
  client.println("Content-Type: text/event-stream;charset=UTF-8");
  client.println("Connection: close");  // the connection will be closed after completion of the response
  client.println("Access-Control-Allow-Origin: *");  // allow any connection. We don't want Arduino to host all of the website ;-)
  client.println("Cache-Control: no-cache");  // refresh the page automatically every 5 sec
  client.println();
  client.flush();
}
