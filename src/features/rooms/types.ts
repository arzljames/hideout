import type { components } from '@/lib/api/schema.gen'

type Schemas = components['schemas']

// Aliases of the hideout-api contract types; never redeclare these shapes by hand.
export type Room = Schemas['Room']
export type RoomDetail = Schemas['RoomDetail']
export type MyRoom = Schemas['MyRoom']
export type Channel = Schemas['Channel']
export type Member = Schemas['Member']
export type Role = Schemas['Role']
export type RoomIcon = Schemas['RoomIcon']
export type ProfileSummary = Schemas['ProfileSummary']
export type CreateRoomBody = Schemas['CreateRoomBody']
export type UpdateRoomBody = Schemas['UpdateRoomBody']
