

<p align="center">
    <img src="http://cl.ly/769be81b3540/car.svg" alt="Eqn solver logo" width=100 height=100>
  <h3 align="center">Car2Go Automation Server</h3>


  <p align="center">
    A reverse engineering project.
    <br>
      Car2Go reservation automation PoC.
  </p>


</p>

<br>

### Setup

1. Clone the repository and `cd` into the directory
2. Perform `yarn install`
3. Setup environment variables in `.env` file. 

## [Writeup](https://medium.com/@zhao.steven/reverse-engineering-car2go-98d5f0f78a96)

### Reverse Engineering Car2Go

There are usually zero Car2Go vehicles available after 6PM on campus — and I
need to go home. It’s a warzone with fellow students to see who can snatch up
the next available car.

![](https://cdn-images-1.medium.com/max/1600/1*5oOouDJEH6EuHWhPG6O1NQ.png)

I have always been curious about the technical infrastructure of Car2Go and its
app, so with this pain point, I figured it was the perfect excuse to reverse,
analyze, and see if it’s possible to build an auto-reserver.

*****

### Intercepting Traffic

My goal is to understand the communication between the app and Car2Go’s servers
well enough to rebuild my own client. At first, I figured it would be a simple
matter of intercepting, reading HTTP traffic, and ultimately finding the REST
endpoints the app would call.

The endpoints I needed to find are related to authentication, car locations, and
reservations because my client would need to login, scan, and reserve.

I’ve setup my environment using Charles, an HTTP web debugging proxy, to
intercept Car2Go running on an Android emulator. Here’s what I found:

#### **JWT Authentication**

Car2Go uses JSON Web Tokens (JWT) for authentication.

The app makes a login request to
`https://www.car2go.com/auth/realms/c2gcustomer/protocol/openid-connect/token` ,
which returns a `refresh_token` and an `access_token`

`access_token` is a temporary token used to make authenticated calls , and
`refresh_token` is used to renew it.

![](https://cdn-images-1.medium.com/max/1600/1*ZkDfWU6Ut6yZqJz7n7FpMw.png)
<span class="figcaption_hack">Calling Car2Go for token refresh</span>

#### Car Locations & Reservations

Here was when I realized this project would be more complex than I initially
thought.

After refreshing the app multiple times and reserving a few cars, I found **zero
HTTP calls** related to car locations and reservation requests.

The proxy currently only intercepts HTTP requests — so if Car2Go is making those
requests through another protocol, I would not be able to see them. I then
configured the proxy to forward all socket-based communication.

*****

With this new configuration, I found one new request:

![](https://cdn-images-1.medium.com/max/1600/1*ccnQBovCqqzdEoI0xkSSSA.png)
<span class="figcaption_hack">SSL Error</span>

A reverse lookup on `159.122.74.100` reveals `driver.na.car2go.com` is the
domain. Despite installing a root certificate on the emulator, I wasn’t able to
look at the contents of this request.

This is because Car2Go implemented **SSL Pinning** for this endpoint.
**(**[https://developer.android.com/training/articles/security-ssl#Pinning](https://developer.android.com/training/articles/security-ssl#Pinning))

I will not be able to intercept and read any requests as the app restricts the
CAs to a trusted subset — ignoring my root certificate installed on the device.

*****

#### Disabling SSL Pinning

Car2Go uses Android’s recommended way of SSL pinning — using SSLContext to
verify CAs. Fortunately, this means we can just use Frida, an Android
instrumentation framework, to disable it.

![](https://cdn-images-1.medium.com/max/1600/1*PBAAuVI5UJbBcOvJlnlvog.png)
<span class="figcaption_hack">Disabling Car2Go SSL Pinning</span>

*****

#### MQTT Protocol

**Great!** With SSL Pinning disabled, we can now see the request!

![](https://cdn-images-1.medium.com/max/1600/1*NBwt8wyM_eLSURWtdQYfgA.png)

… which is a jumbled mess. However, this provided valuable insight to what
protocol Car2Go is using — **MQTT.**

![](https://cdn-images-1.medium.com/max/1600/1*8Mxk78p5kuexH-bXQ4x44w.png)

> **MQTT:** A lightweight messaging protocol for small sensors and mobile devices,
> optimized for high-latency or unreliable networks

Instead of HTTP, it looks like the reserve and car locations are served over
MQTT. It is a lightweight publish-subscribe protocol. 
