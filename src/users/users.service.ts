import { Injectable, NotFoundException } from '@nestjs/common';
import { EnumUserRole } from '../common/enums/user.roles';
import { CreateUserDto } from './dtos/create.user.dto';
import { UpdateUserDto } from './dtos/update.user.dto';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from 'src/users/schemas/user.schema';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  private users = [
    {
      id: 1,
      name: 'John Doe',
      email: 'john.doe@example.com',
      role: 'INTERN',
    },
    {
      id: 2,
      name: 'Jane Doe',
      email: 'jane.doe@example.com',
      role: 'ENGINEER',
    },
    {
      id: 3,
      name: 'Bob Doe',
      email: 'bob.doe@example.com',
      role: 'ADMIN',
    },
  ];

  findAll(role?: EnumUserRole) {
    if (role) {
      return this.users.filter((user) => user.role === role);
    }
    return this.users;
  }

  findOne(id: number) {
    const foundUser = this.users.find((user) => user.id === id);

    if (!foundUser) {
      throw new NotFoundException(`User with id ${id} not found`);
    }

    return foundUser;
  }

  async create(user: CreateUserDto) {
    // const createdUser = new this.userModel({
    //   name: user.name,
    //   email: user.email,
    //   role: user.role,
    // });
    // return createdUser.save();
    const createdUser = await new this.userModel({
      name: user.name,
      email: user.name,
      role: user.role,
    }).save();
    return createdUser.public();
  }

  update(id: number, toBeUpdatedUser: UpdateUserDto) {
    this.users = this.users.map((user) => {
      if (user.id === id) {
        user.name = toBeUpdatedUser.name || user.name;
        user.email = toBeUpdatedUser.email || user.email;
        user.role = toBeUpdatedUser.role || user.role;
      }
      return user;
    });

    return this.findOne(id);
  }

  delete(id: number) {
    const removedUser = this.findOne(id);
    this.users = this.users.filter((user) => user.id !== id);
    return removedUser;
  }
}
