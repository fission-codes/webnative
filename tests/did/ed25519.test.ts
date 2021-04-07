import { loadWebnativePage } from '../helpers/page'


describe('UCAN', () => {
  beforeEach(async () => {
    await loadWebnativePage()
  })

  it('can validate', async () => {
    const isValid = await page.evaluate(async () => {
      const ucan = "eyJ1YXYiOiIxLjAuMCIsImFsZyI6IkVkRFNBIiwiY3R5IjpudWxsLCJ0eXAiOiJKV1QifQ.eyJwdGMiOiJBUFBFTkQiLCJuYmYiOjE2MTc4MTU0MjQsInJzYyI6eyJ3bmZzIjoiLyJ9LCJleHAiOjE2MTc4MTU0ODQsImlzcyI6ImRpZDprZXk6elN0RWV4RkpDVnVENmhDQWVQeTVrdEtYRURrZUdteVZEQkNOcmVodm84WTZhV1AyaEpSa0dRU3hCWlAxWXJwVSIsInByZiI6ImV5SmhiR2NpT2lKU1V6STFOaUlzSW5SNWNDSTZJa3BYVkNJc0luVmhkaUk2SWpFdU1DNHdJbjAuZXlKaGRXUWlPaUprYVdRNmEyVjVPbnBUZEVWbGVFWktRMVoxUkRab1EwRmxVSGsxYTNSTFdFVkVhMlZIYlhsV1JFSkRUbkpsYUhadk9GazJZVmRRTW1oS1VtdEhVVk40UWxwUU1WbHljRlVpTENKbGVIQWlPak15TnpJeE1qQTNNRFk1TENKbVkzUWlPbHRkTENKcGMzTWlPaUprYVdRNmEyVjVPbm94TTFZelUyOW5NbGxoVlV0b1pFZERiV2Q0T1ZWYWRWY3hiekZUYUVaS1dXTTJSSFpIV1dVM1RsUjBOamc1VG05TU5ESm1NVU4wWW1kRFlWVlhlbFppTVhOcU5WZ3lhV1JCTlhGaE5rWldjamhqWlhwWFNETjBPRE5xU0hGdGFsQlFTRFI2WVZZemMzSk1jek5GZG10eGNrRmtPVVpYYTNjeVdXMTBTMUI1WmtNM1VuTmFSVXBPZG01V1pETkJNbGxVU0ZGRVZFUjBTelpvYWpONFlsaFJObXRCU0dGNGFtMTVjMHAwWW1sNlozSnRSVlpxVkhKb2RreFNhM1JRWVRSWmJtRkJNV05SUm01M1FWZERkMGRJUm0xemEybG5VR1k0ZFVaWFlVTkZaVFkwU0V4bVNGQmlOR0puWW5ob2QzUjFjbk4yVUV4RFkxQndNa0ZGY2pKM1VWRnJURkJqWlhGWVZsZHZOVXAxVEhCRk4wdGxjMEZYZG5abWVuaE9VbkZXVGxoQmFFNVVWSGhZU2pWWGMxWjRjVnBDUWtVMGEzZGhjSHB0YzBkMGNqVmtXSGs0TTFSS1dtaHVjemMwU0c1dFVHTmFNblpMYXpZeWRXaDVObTV0VWtKR1FXTnFaR3RPVW5GeWREbFpXbmh4WTA1RlNIcHpZbVZJWTBORVVGaEJRMFoyWWtVM1kweFRWMXBpY2s0eVZtRk5aVUpUSWl3aWJtSm1Jam94TmpFM01qQTNNREE1TENKd2RHTWlPaUpCVUZCRlRrUWlMQ0p5YzJNaU9pSXFJbjAuRWJ3R0dkVWNyMUlqVjZtbGNBTnhOYUdqakRxUUNzbi1TSjF1djU1a3VhZkJLOUtGQU1hTndzOXFMWnZnQld6Y21XUHZvN0dGXzlnS2dWVWItQm80VElVLXFYWWJnWGYtcTgzeU04b3p6dFBvSks2N2NTcmk0VWNuRk9nZ2FtM1ZCRDJZbktDVnhFSXdTbjJyNFFySS1XaS1CRk9jbm4xdTFSSm1ydDRmUkIxa3N4cHRiRVNvNDh0VFdobDM1WjF1eVhvOEVBUkNfdGFseWFaNXRKWFhpYks1ZEplZnYwV0pFdnNCMjRkMlFNRXlvT1FMd05fZ0Jub1FvY0Rad1hHdXJHc1dWX1BVOGF5M01od0QxN1MzS1VOSHJwN2treWx4VDRnb1JmbFV1bTdxaHlOQmRtR09UdUpTaU1abEFWeWFMV2ZGNzlqdFdaaHFkQnBHNGF2b2Z3IiwiYXVkIjoiZGlkOmtleTp6U3RFWnB6U010VHQ5azJ2c3pndkN3RjRmTFFRU3lBMTVXNUFRNHozQVI2Qng0ZUZKNWNySkZidUd4S21ibWE0IiwiZmN0IjpbXX0.6bQqItK4e-dRLGE39Kl5W94tmtDi0muUwjTPWjImIPqa4RN0MEBKVj4RlpChKNYpECkfgZlnOqKiBpU67hpFBw"

      const decodedUcan = webnative.ucan.decode(ucan)

      return webnative.did.verifySignedData({
        charSize: 8,
        data: ucan.split(".").slice(0, 2).join("."),
        did: decodedUcan.payload.iss,
        signature: decodedUcan.signature.replace(/_/g, "/").replace(/-/g, "+")
      })
    })

    expect(isValid).toBe(true)
  })
});