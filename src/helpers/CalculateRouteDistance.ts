import * as L from 'leaflet'

export default function calculateRouteDistance(coordinates: [number, number, number?][]): {
    distance: number
    gain: number
    loss: number
} {
    let distance = 0,
        gain = 0,
        loss = 0

    for (let index = 1; index < coordinates.length; index++) {
        const currentCoordinate = coordinates[index]
        const previousCoordinate = coordinates[index - 1]

        distance += L.latLng(currentCoordinate).distanceTo(L.latLng(previousCoordinate))

        if (currentCoordinate[2] === undefined || previousCoordinate[2] === undefined) continue

        const diff = currentCoordinate[2] - previousCoordinate[2]
        if (diff > 0) {
            gain += diff
        } else {
            loss -= diff
        }
    }

    distance = distance / 1000

    return { distance, gain, loss }
}
