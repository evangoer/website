/* eslint-disable consistent-return */
/* eslint-disable no-useless-return */
import React, { useState, useMemo, useEffect } from 'react'

import { json } from 'd3-fetch'
import { nest, set } from 'd3-collection'
import { sum } from 'd3-array'

import Map, { path } from './charts/_Map'
import StatesWithPopulation from './data/_state-populations'

import { formatDate, formatNumber, parseDate } from './_utils'

import './map-container.scss'

const MapContainer = () => {
  const [dates, setDates] = useState([])
  const [sliderIndex, setSliderIndex] = useState(0)

  const [sliderInterval, setSliderInterval] = useState(null)
  // holds the date of the displayed day
  const currentDate = useMemo(() => dates[sliderIndex], [dates, sliderIndex])
  // holds the field we are currently viewing
  const [currentField, setCurrentField] = useState('positive')

  const [useChoropleth, setUseChoropleth] = useState(false)

  const [rawStateData, setRawStateData] = useState(null)

  const [playing, setPlaying] = useState(false)

  const getValue = useMemo(
    () => (d, field = currentField, normalized = false) =>
      ((d.properties.dailyData[currentDate] &&
        d.properties.dailyData[currentDate][field]) ||
        0) / (normalized ? d.properties.population / 1000000 : 1),
    [currentDate, currentField],
  )

  const joinedData = useMemo(() => {
    if (!rawStateData || !path) return null
    const createMapFromArray = (array, keyField, valueField = null) => {
      return Object.assign(
        {},
        ...array.map(a => ({ [a[keyField]]: valueField ? a[valueField] : a })),
      )
    }
    const groupedByState = nest()
      .key(d => d.state)
      .entries(rawStateData)
    const stateMap = createMapFromArray(groupedByState, 'key', 'values')
    const joinedFeatures = StatesWithPopulation.features.map(feature => ({
      ...feature,
      properties: {
        ...feature.properties,
        centroidCoordinates: path.centroid(feature), // should get rid of turf and use d3 for the centroid
        dailyData: createMapFromArray(
          stateMap[feature.properties.STUSPS],
          'date',
        ),
      },
    }))
    return { ...StatesWithPopulation, features: joinedFeatures }
  }, [rawStateData])

  const sumTotalTestResults = useMemo(
    () =>
      joinedData &&
      sum(joinedData.features, d => getValue(d, 'totalTestResults')),
    [joinedData, currentDate],
  )
  const sumPositive = useMemo(
    () => joinedData && sum(joinedData.features, d => getValue(d, 'positive')),
    [joinedData, currentDate],
  )

  const sumChoro = useMemo(
    () => joinedData && sum(joinedData.features, d => getValue(d)),
    [joinedData, getValue],
  )

  useEffect(() => {
    const fetchData = async () => {
      const stateData = await json('https://covidtracking.com/api/states/daily')
      setRawStateData(stateData)
      const tempDates = set(stateData.map(s => s.date))
        .values()
        .reverse()
      setDates(tempDates)
      setSliderIndex(tempDates.length - 1)
    }
    fetchData()
  }, [])
  const stop = () => {
    clearInterval(sliderInterval)
    setPlaying(false)
    setSliderInterval(null)
  }
  useEffect(() => {
    if (sliderIndex === dates.length - 1) {
      return stop()
    }
    return
  }, [sliderIndex, dates])
  useEffect(() => {
    const start = () => {
      if (sliderIndex === dates.length - 1) {
        setSliderIndex(0)
      }
      setSliderInterval(
        setInterval(() => {
          setSliderIndex(i => i + 1)
        }, 500),
      )
    }
    if (playing && !sliderInterval) start()
    else stop()
    return
  }, [playing])
  const propertyOptions = [
    {
      value: 'positive',
      name: 'Positive Cases',
    },
    {
      value: 'totalTestResults',
      name: 'Total Tests',
    },
    {
      value: 'death',
      name: 'Deaths',
    },
  ]
  const togglePlaying = event => {
    console.log('togglePlaying: ', event)
    setPlaying(p => !p)
  }

  const toggleMapStyle = () => setUseChoropleth(u => !u)

  return (
    <div id="state-map">
      <div
        id="map-style-button"
        onClick={toggleMapStyle}
        onKeyPress={toggleMapStyle}
        role="switch"
        aria-checked={useChoropleth}
        tabIndex={0}
      >
        <span className={useChoropleth ? '' : 'active'}>Bubble Map</span>
        <span className={useChoropleth ? 'active' : ''}>Choropleth</span>
      </div>
      <div id="map-dek">
        <h2>{formatDate(parseDate(currentDate))}</h2>
        {useChoropleth ? (
          <div>
            <span>{formatNumber(sumChoro)}</span>{' '}
            <select
              value={currentField}
              onChange={e => setCurrentField(e.target.value)}
            >
              {propertyOptions.map(({ value, name }) => (
                <option value={value}>{name}</option>
              ))}
            </select>
          </div>
        ) : (
          <>
            <div>
              <span>{formatNumber(sumTotalTestResults)}</span>{' '}
              <span className="legend-text total">tests conducted</span>
            </div>
            <div>
              <span>{formatNumber(sumPositive)}</span>{' '}
              <span className="legend-text positive">positive tests</span>
            </div>
          </>
        )}
        <div id="map-time-scrubber">
          <div
            id="map-start-stop"
            className={playing ? 'stop' : 'start'}
            onClick={() => togglePlaying()}
            onKeyDown={() => togglePlaying()}
            role="switch"
            label={playing ? 'stop' : 'start'}
            aria-checked={playing}
            tabIndex={0}
          />
          <input
            onChange={event => setSliderIndex(parseInt(event.target.value, 10))}
            min={0}
            max={dates.length - 1}
            value={sliderIndex}
            type="range"
          />
        </div>
      </div>
      {joinedData && (
        <Map
          data={joinedData}
          getValue={getValue}
          currentDate={currentDate}
          currentField={currentField}
          useChoropleth={useChoropleth}
        />
      )}
    </div>
  )
}

export default MapContainer
