import React from 'react';
import { render, screen } from '@testing-library/react-native';
import ActionButton from '../action-button';

describe('ActionButton', () => {
  it('renders correctly with default props', () => {
    render(<ActionButton title="Test Button" onPress={() => {}} />);
    
    const button = screen.getByText('Test Button');
    expect(button).toBeTruthy();
  });

  it('calls onPress when pressed', () => {
    const onPressMock = jest.fn();
    const { getByText } = render(
      <ActionButton title="Press Me" onPress={onPressMock} />
    );
    
    const button = getByText('Press Me');
    button.props.onPress();
    
    expect(onPressMock).toHaveBeenCalledTimes(1);
  });
});
